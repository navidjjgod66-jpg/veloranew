import { $, openDialog } from './core.js';

export function authInit() {
  const authButton = $('#authBtn');
  const authDialog = $('#authDialog');
  if (!authButton || !authDialog) return;

  authButton.addEventListener('click', () => openDialog(authDialog));
}
