/* ═══ VELORA · 13 — Motion & effects ═══
   The page runs on a deliberate rule: one gesture per section. This module owns
   the four that remain — the boot veil, scroll reveals, the hero shader and the
   pointer-following specular on the featured card. Everything here runs on the
   shared ticker from core.js and only while its element is on screen, so
   off-screen sections cost nothing. */
import {
  $,
  $$,
  faNum,
  fine,
  hasPremiumMotion,
  motion,
  onFrame,
  onPaletteChange,
  runWhileOnscreen,
  resolvedTheme,
  TIER,
  VIEW_TLS,
} from './core.js';

export function veilInit() {
  const veil = $('.veil');
  if (!veil) return;
  const kill = () => veil.remove();
  if (motion.matches) {
    kill();
    return;
  }
  veil.addEventListener('pointerdown', kill, { once: true });
  veil.addEventListener('animationend', e => {
    if (e.animationName === 'veil-out') kill();
  });
  setTimeout(kill, 2800);
}

/* Scroll reveals. GSAP used to drive these; it is gone, so they now run on an
   IntersectionObserver plus a CSS transition, which the compositor can animate
   without a library in the loop. Where the browser supports scroll-driven
   animations the work moves off the main thread entirely — see .rv in
   base.css — and this observer is only the fallback.

   `once: true` semantics are preserved by unobserving each element the moment
   it lands, so nothing keeps observing 75 nodes for the life of the page. */
export function revealInit() {
  const items = $$('.rv');
  if (!items.length) return;

  if (motion.matches || !('IntersectionObserver' in window)) {
    for (const el of items) el.classList.add('in');
    return;
  }
  document.documentElement.classList.add('js');

  /* Where a view timeline drives the reveal, base.css already animates it on the
     compositor — as its own comment says, no JS and no observer. Observing the
     75 nodes anyway would buy nothing and cost a class write plus a style
     invalidation per element on the way down the page. */
  if (VIEW_TLS) return;

  const io = new IntersectionObserver(
    entries => {
      for (const en of entries)
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
    },
    { threshold: 0.08, rootMargin: '0px 0px -6% 0px' }
  );
  for (const el of items) io.observe(el);
}

/* ─── WebGL hero ─── */
const SHADER_VERT = `#version 300 es
in vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

/* Octave and line counts are compiled in, so the cheaper tiers get a
   genuinely smaller shader. */
const shaderFrag = (OCTAVES, LINES) => `#version 300 es
precision highp float;uniform vec2 u_res;uniform float u_time;uniform vec2 u_mouse;uniform vec3 u_col1;uniform vec3 u_col2;out vec4 o;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<${OCTAVES};i++){v+=a*noise(p);p*=2.02;a*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/u_res;vec2 p=(gl_FragCoord.xy-.5*u_res)/min(u_res.x,u_res.y);
float lines=0.;for(int i=0;i<${LINES};i++){float fi=float(i);float phase=fi*.42+u_time*.07;float amp=.28+.22*sin(fi*.85+u_time*.09);vec2 off=vec2(sin(phase)*amp,cos(phase*1.25)*amp*.55);vec2 q=p+off;float a=fi*3.14159/${LINES}.+u_time*.025;mat2 r=mat2(cos(a),-sin(a),sin(a),cos(a));q=r*q;float d=abs(q.x);lines+=exp(-d*d*45.)*(.55+.45*sin(q.y*9.+u_time+fi))*.075;}
vec2 mp=(u_mouse*u_res-.5*u_res)/min(u_res.x,u_res.y);float md=distance(p,mp);float glow=exp(-md*md*3.5)*.22;
float n=fbm(p*2.2+u_time*.12);float intensity=(lines+glow*.7+n*.35);
vec3 col=mix(u_col1,u_col2,clamp(intensity*2.2,0.,1.));
float alpha=smoothstep(0.,.08,intensity)*.55;float vig=smoothstep(1.25,.35,length(p));
o=vec4(col*intensity*vig*1.15,alpha*vig);}`;

function buildProgram(gl, vertSrc, fragSrc) {
  const compile = (type, src) => {
    const shader = gl.createShader(type);
    /* A lost context makes every call below return null; bail instead of
       throwing, so the hero degrades to its CSS background. */
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return shader;
  };
  const vs = compile(gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  /* Compiling and linking used to block the main thread until the driver was
     done with them. Profiling put that block at 379ms — by far the longest on
     the page — and it landed while the veil was still covering the hero, where
     every millisecond of it was jank nobody could even see. Where the driver
     supports it, KHR_parallel_shader_compile does the work off-thread and this
     becomes a flag to check instead. The status getters below are only safe
     once `complete()` is true, which is exactly the contract the extension
     defines. */
  const ext = gl.getExtension('KHR_parallel_shader_compile');
  return {
    program,
    complete: () => (ext ? gl.getProgramParameter(program, ext.COMPLETION_STATUS_KHR) : true),
    usable: () =>
      gl.getShaderParameter(vs, gl.COMPILE_STATUS) &&
      gl.getShaderParameter(fs, gl.COMPILE_STATUS) &&
      gl.getProgramParameter(program, gl.LINK_STATUS),
  };
}

/* oklch -> sRGB, so the canvas can paint the same accent the CSS uses. */
const srgb = x => (x > 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x);
function oklchToRgb(l, c, h) {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad),
    b = c * Math.sin(rad);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3,
    m3 = m_ ** 3,
    s3 = s_ ** 3;
  return [
    srgb(Math.max(0, 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3)),
    srgb(Math.max(0, -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3)),
    srgb(Math.max(0, -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3)),
  ];
}
const ACCENT_HUE = { gold: 86, platinum: 95, rose: 18, emerald: 165, sapphire: 265 };

export function shaderInit() {
  const canvas = $('#shader-canvas');
  const hero = $('.hero');
  if (!canvas || !hero || !hasPremiumMotion()) return;

  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    powerPreference: 'low-power',
  });
  if (!gl) {
    canvas.remove();
    return;
  }

  const OCTAVES = TIER >= 2 ? 3 : 5;
  const LINES = TIER >= 1 ? 10 : 14;

  const built = buildProgram(gl, SHADER_VERT, shaderFrag(OCTAVES, LINES));
  if (!built) {
    canvas.remove();
    return;
  }

  /* Everything that needs a real, linked program happens here, so the polled
     path and the synchronous path run identical setup. */
  const begin = () => {
    gl.useProgram(built.program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(built.program, 'p');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const u_res = gl.getUniformLocation(built.program, 'u_res');
    const u_time = gl.getUniformLocation(built.program, 'u_time');
    const u_mouse = gl.getUniformLocation(built.program, 'u_mouse');
    const u_col1 = gl.getUniformLocation(built.program, 'u_col1');
    const u_col2 = gl.getUniformLocation(built.program, 'u_col2');

    /* Recomputed only when the accent or theme actually changes — this used to
       run the full colour conversion twice per animation frame. */
    const accent = { c1: [0, 0, 0], c2: [0, 0, 0] };
    function refreshAccent() {
      const dark = resolvedTheme() === 'dark';
      const hue = ACCENT_HUE[document.documentElement.dataset.accent] ?? ACCENT_HUE.gold;
      accent.c1 = oklchToRgb(dark ? 0.35 : 0.55, 0.08, hue);
      accent.c2 = oklchToRgb(dark ? 0.75 : 0.45, 0.18, hue);
    }
    refreshAccent();
    onPaletteChange(refreshAccent);

    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let heroBox = null;
    const dprCap = TIER === 0 ? 1.5 : TIER === 1 ? 1.25 : 1;

    const resize = () => {
      heroBox = hero.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, dprCap);
      canvas.width = Math.round(heroBox.width * dpr);
      canvas.height = Math.round(heroBox.height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const started = performance.now();
    function tick() {
      const t = (performance.now() - started) / 1000;
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      gl.uniform2f(u_res, canvas.width, canvas.height);
      gl.uniform1f(u_time, t);
      gl.uniform2f(u_mouse, pointer.x, 1 - pointer.y);
      gl.uniform3f(u_col1, accent.c1[0], accent.c1[1], accent.c1[2]);
      gl.uniform3f(u_col2, accent.c2[0], accent.c2[1], accent.c2[2]);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    const setPointer = e => {
      if (!heroBox) resize();
      pointer.tx = (e.clientX - heroBox.left) / heroBox.width;
      pointer.ty = (e.clientY - heroBox.top) / heroBox.height;
    };
    hero.addEventListener('pointermove', setPointer, { passive: true });
    addEventListener('resize', resize, { passive: true });

    resize();
    runWhileOnscreen(
      hero,
      () => onFrame(tick),
      () => {}
    );
  };

  if (built.complete()) {
    if (built.usable()) begin();
    else canvas.remove();
    return;
  }

  /* Compiling in the driver: watch for completion on the frame loop. After the
     deadline the status getters below fall back to their synchronous
     behaviour — the driver's answer, just late — so the shader is never
     silently dropped while the user could still get it. */
  const deadline = performance.now() + 4000;
  const stopPoll = onFrame((_dt, now) => {
    if (!built.complete() && now < deadline) return;
    stopPoll();
    if (built.usable()) begin();
    else canvas.remove();
  });
}

/* ─── Custom cursor ─── */
const CURSOR_HINTS = [
  ['[data-case],[data-qv]', 'بازکن'],
  ['[data-essay]', 'بخوان'],
  ['.btn-solid', 'اقدام'],
  ['[data-add]', 'رزرو'],
];
const INTERACTIVE = 'a,button,summary,[role="option"],input,select,textarea';

export function cursorInit() {
  const dot = $('#cursorDot');
  if (!dot || motion.matches || !fine.matches) {
    dot?.remove();
    return;
  }
  const label = $('.cursor-label', dot);

  /* Walks up from the hit target and stops at the first match, so the nearest
     element wins. One querySelector per event instead of five closest() calls. */
  const hintFor = target => {
    for (let el = target; el && el !== document.body; el = el.parentElement) {
      for (const [selector, text] of CURSOR_HINTS) if (el.matches(selector)) return text;
      if (!el.parentElement) break;
    }
    return '';
  };

  let tx = innerWidth / 2,
    ty = innerHeight / 3,
    cx = 0,
    cy = 0;
  let stop = null,
    shown = false,
    idleTimer = 0;
  const IDLE_MS = 1500;

  function tick() {
    cx += (tx - cx) * 0.22;
    cy += (ty - cy) * 0.22;
    dot.style.transform = `translate3d(${cx}px,${cy}px,0)`;
  }

  const start = () => {
    if (!stop) stop = onFrame(tick);
  };
  const park = () => {
    stop?.();
    stop = null;
  };
  /* Restart the countdown on every move so an idle page uses no frames at all. */
  const wake = () => {
    start();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(park, IDLE_MS);
  };

  addEventListener(
    'pointermove',
    e => {
      tx = e.clientX;
      ty = e.clientY;
      if (!shown) {
        shown = true;
        document.body.classList.add('cursor-on');
      }
      wake();
    },
    { passive: true }
  );

  addEventListener('pointerdown', () => dot.classList.add('is-down'));
  addEventListener('pointerup', () => dot.classList.remove('is-down'));
  addEventListener('pointercancel', () => dot.classList.remove('is-down'));

  document.addEventListener('pointerover', e => {
    const hit = e.target.closest?.(INTERACTIVE);
    dot.classList.toggle('is-link', !!hit);
    const text = hit ? hintFor(hit) : '';
    dot.classList.toggle('has-label', !!text);
    if (text && label) label.textContent = text;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearTimeout(idleTimer);
      park();
    } else if (shown) wake();
  });
}

/* ─── Featured-card specular ───
   The card's highlight tracks the pointer through --gx / --gy, registered as
   typed percentages in tokens.css. Only the featured card gets it: the old
   version rotated every card in 3D and lit all three at once, which turned a
   material detail into wallpaper. */
export function specularInit() {
  if (!hasPremiumMotion() || !fine.matches) return;
  for (const card of $$('.p-card.is-featured')) {
    let box = null,
      frame = 0;
    card.addEventListener(
      'pointerenter',
      () => {
        box = card.getBoundingClientRect();
      },
      { passive: true }
    );
    card.addEventListener(
      'pointermove',
      e => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (!box) box = card.getBoundingClientRect();
          card.style.setProperty(
            '--gx',
            (((e.clientX - box.left) / box.width) * 100).toFixed(1) + '%'
          );
          card.style.setProperty(
            '--gy',
            (((e.clientY - box.top) / box.height) * 100).toFixed(1) + '%'
          );
        });
      },
      { passive: true }
    );
    card.addEventListener('pointerleave', () => {
      box = null;
      card.style.removeProperty('--gx');
      card.style.removeProperty('--gy');
    });
  }
}

/* ─── Count-up numbers ─── */
export function countersInit() {
  const els = $$('[data-count]');
  if (!els.length || motion.matches || !('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver(
    entries => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        const el = en.target;
        const end = Number(el.dataset.count);
        const pad = el.textContent.length;
        const started = performance.now();
        const stop = onFrame(() => {
          const k = Math.min(1, (performance.now() - started) / 950);
          const eased = 1 - Math.pow(1 - k, 3);
          el.textContent = faNum(String(Math.round(end * eased)).padStart(pad, '0'));
          if (k >= 1) stop();
        });
      }
    },
    { threshold: 0.5 }
  );

  for (const el of els) io.observe(el);
}
