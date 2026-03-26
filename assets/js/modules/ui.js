import { $, $$ } from './state.js';

let toastTimer = null;
let clockTimer = null;

function showToast(message) {
  const toast = $('[data-toast]');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2600);
}

function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  $$('[data-live-time]').forEach((node) => {
    node.textContent = `${hours}:${minutes}`;
  });
}

function initClock() {
  if (clockTimer) return;
  updateClock();
  clockTimer = setInterval(updateClock, 15000);
}

function applyDevice(state) {
  const frame = $('[data-device-frame]');
  const shell = $('[data-device-shell]');
  if (frame) frame.dataset.deviceFrame = state.device;
  if (shell) shell.dataset.device = state.device;
  $$('[data-device-option]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.deviceOption === state.device);
  });
}

function applyImmersive(state) {
  const immersive = Boolean(state.immersive);
  document.documentElement.dataset.immersive = immersive ? 'true' : 'false';
  document.body.classList.toggle('is-immersive', immersive);
  syncImmersiveButtons(immersive);
}

function applyContrast(state) {
  document.body.classList.toggle('high-contrast', Boolean(state.settings.highContrast));
}

function applyTheme(state) {
  const theme = state.settings.themeMode === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
  syncThemeButtons(theme);
}

function syncThemeButtons(theme) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const textLabel = nextTheme === 'light' ? 'Modo claro' : 'Modo oscuro';
  const iconLabel = nextTheme === 'light' ? '☀' : '☾';
  $$('[data-theme-toggle]').forEach((button) => {
    button.dataset.nextTheme = nextTheme;
    button.textContent = textLabel;
    button.setAttribute('aria-label', textLabel);
  });
  $$('[data-theme-toggle-icon]').forEach((button) => {
    button.dataset.nextTheme = nextTheme;
    button.textContent = iconLabel;
    button.setAttribute('aria-label', textLabel);
  });
}

function syncImmersiveButtons(immersive) {
  const textLabel = immersive ? 'Comprimir' : 'Expandir';
  const ariaLabel = immersive ? 'Comprimir interfaz' : 'Expandir interfaz';
  const iconLabel = immersive ? '⤡' : '⤢';
  $$('[data-expand-toggle]').forEach((button) => {
    button.textContent = textLabel;
    button.setAttribute('aria-label', ariaLabel);
    button.setAttribute('title', textLabel);
  });
  $$('[data-expand-toggle-icon]').forEach((button) => {
    button.textContent = iconLabel;
    button.setAttribute('aria-label', ariaLabel);
    button.setAttribute('title', textLabel);
  });
}

function renderViewOnly(view) {
  $$('[data-view]').forEach((node) => {
    node.classList.toggle('is-active', node.dataset.view === view);
  });
  $$('[data-view-target]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.viewTarget === view);
  });
  $$('.nav-link').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.viewTarget === view);
  });
  $$('.bottom-nav button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.viewTarget === view);
  });
}

function openOverlay(node) {
  if (!node) return;
  node.classList.add('is-open');
  document.body.classList.add('overlay-open');
}

function closeOverlay(node) {
  if (!node) return;
  node.classList.remove('is-open');
  if (!$('.overlay.is-open')) {
    document.body.classList.remove('overlay-open');
  }
}

function closeAllOverlays() {
  $$('.overlay').forEach((overlay) => {
    overlay.classList.remove('is-open');
  });
  document.body.classList.remove('overlay-open');
}

function scrollAppToTop() {
  ['.app-main', '.app-sidebar', '.app-rail'].forEach((selector) => {
    $$(selector).forEach((node) => {
      node.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function burstNotesFrom(node) {
  if (!node) return;
  const rect = node.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const notes = ['♪', '♫', '♩', '♬'];
  notes.forEach((symbol, index) => {
    const note = document.createElement('span');
    note.className = 'note-burst';
    note.textContent = symbol;
    note.style.left = `${centerX}px`;
    note.style.top = `${centerY}px`;
    note.style.setProperty('--note-x', `${(index - 1.5) * 22}px`);
    note.style.setProperty('--note-y', `${-36 - index * 8}px`);
    note.style.animationDelay = `${index * 50}ms`;
    document.body.append(note);
    note.addEventListener('animationend', () => {
      note.remove();
    }, { once: true });
  });
}

export {
  applyContrast,
  applyDevice,
  applyImmersive,
  applyTheme,
  burstNotesFrom,
  closeAllOverlays,
  closeOverlay,
  initClock,
  openOverlay,
  renderViewOnly,
  scrollAppToTop,
  showToast,
  syncImmersiveButtons,
  syncThemeButtons,
  updateClock
};
