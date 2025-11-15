/**
 * Tests for assets/js/theme.js behaviors using Jest (JSDOM environment).
 */

// JSDOM is the default testEnvironment in Jest when using jsdom preset; define mocks needed.

// Mock matchMedia with configurable return
function setupMatchMedia(dark = false) {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: dark && query === "(prefers-color-scheme: dark)",
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

// Minimal stubs for global third-party integrations used in applyTheme
beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-setting");
  // Reset DOM body
  document.body.innerHTML = `
    <button id="light-toggle"></button>
    <table id="t1"></table>
    <div class="jupyter-notebook-iframe-container"><iframe></iframe></div>
    <ninja-keys></ninja-keys>
  `;
  // Provide iframe body to avoid null references
  const iframe = document.querySelector("iframe");
  Object.defineProperty(iframe, "contentWindow", { value: { document: { body: document.createElement("body") } } });

  // LocalStorage isolation
  const store = new Map();
  jest.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation((k) => (store.has(k) ? store.get(k) : null));
  jest.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation((k, v) => { store.set(k, String(v)); });

  // Third-party globals guarded by typeof checks in theme.js
  global.mermaid = undefined;
  global.Diff2HtmlUI = undefined;
  global.echarts = undefined;
  global.Plotly = { relayout: jest.fn() };
  global.vegaEmbed = undefined;
  global.medium_zoom = { update: jest.fn() };

  // getComputedStyle used by medium_zoom.update
  jest.spyOn(window, 'getComputedStyle').mockImplementation(() => ({ getPropertyValue: () => '#000000' }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Load the module under test after environment is set for each test
function loadThemeModule() {
  // Clear from require cache to get a fresh copy each time
  jest.resetModules();
  return require('../assets/js/theme.js');
}

// Helper to expose functions from IIFE file: the file defines functions in module scope but not exported.
// We will access via global since the script assigns to global scope (no exports provided). To enable testing,
// we simulate by evaluating the file in the current context and retrieving functions from global via vm.
// However, Node's commonjs require will execute and keep functions in its own module scope.
// As a pragmatic approach, we re-require and then read from global window when side effects run.

// Since theme.js does not export symbols, we will verify behavior via DOM effects:
// - data-theme-setting, data-theme attributes
// - localStorage persistence
// - click handler registered on #light-toggle that cycles theme


test('Should initialize theme setting to system when no saved preference exists', () => {
  setupMatchMedia(false);
  // Simulate initial run by invoking initTheme from window via evaluating file in DOM <script> context
  // Build a script tag and inject source to attach functions to window
  const src = require('fs').readFileSync(require('path').join(__dirname, '../assets/js/theme.js'), 'utf8');
  const script = document.createElement('script');
  script.textContent = src + '\n;window.__exports__ = { determineThemeSetting, determineComputedTheme, setThemeSetting, applyTheme, toggleThemeSetting, initTheme };';
  document.head.appendChild(script);

  window.__exports__.initTheme();

  expect(localStorage.getItem('theme')).toBe('system');
  expect(document.documentElement.getAttribute('data-theme-setting')).toBe('system');
});


test('Should apply dark theme when saved preference is "dark"', () => {
  setupMatchMedia(false);
  const src = require('fs').readFileSync(require('path').join(__dirname, '../assets/js/theme.js'), 'utf8');
  const script = document.createElement('script');
  script.textContent = src + '\n;window.__exports__ = { determineThemeSetting, determineComputedTheme, setThemeSetting, applyTheme, toggleThemeSetting, initTheme };';
  document.head.appendChild(script);

  window.__exports__.setThemeSetting('dark');
  // data-theme set by applyTheme called inside setThemeSetting
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  expect(document.getElementById('t1').classList.contains('table-dark')).toBe(true);
});


test('Should toggle theme and persist selection', () => {
  setupMatchMedia(false);
  const src = require('fs').readFileSync(require('path').join(__dirname, '../assets/js/theme.js'), 'utf8');
  const script = document.createElement('script');
  script.textContent = src + '\n;window.__exports__ = { determineThemeSetting, determineComputedTheme, setThemeSetting, applyTheme, toggleThemeSetting, initTheme };';
  document.head.appendChild(script);

  // Start from system
  window.__exports__.setThemeSetting('system');
  const btn = document.getElementById('light-toggle');
  // Register listener via initTheme (adds click listener)
  window.__exports__.initTheme();

  btn.click(); // system -> light
  expect(localStorage.getItem('theme')).toBe('light');
  expect(document.documentElement.getAttribute('data-theme-setting')).toBe('light');

  btn.click(); // light -> dark
  expect(localStorage.getItem('theme')).toBe('dark');
  expect(document.documentElement.getAttribute('data-theme-setting')).toBe('dark');
});


test('Should update data-theme attribute when theme changes', () => {
  setupMatchMedia(true);
  const src = require('fs').readFileSync(require('path').join(__dirname, '../assets/js/theme.js'), 'utf8');
  const script = document.createElement('script');
  script.textContent = src + '\n;window.__exports__ = { determineThemeSetting, determineComputedTheme, setThemeSetting, applyTheme, toggleThemeSetting, initTheme };';
  document.head.appendChild(script);

  window.__exports__.setThemeSetting('system');
  // With matchMedia dark true, computed theme should be dark
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

  setupMatchMedia(false);
  window.__exports__.applyTheme();
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
});


test('Should respect system prefers-color-scheme when no saved preference exists', () => {
  setupMatchMedia(true);
  const src = require('fs').readFileSync(require('path').join(__dirname, '../assets/js/theme.js'), 'utf8');
  const script = document.createElement('script');
  script.textContent = src + '\n;window.__exports__ = { determineThemeSetting, determineComputedTheme, setThemeSetting, applyTheme, toggleThemeSetting, initTheme };';
  document.head.appendChild(script);

  window.__exports__.initTheme();
  expect(window.__exports__.determineThemeSetting()).toBe('system');
  expect(window.__exports__.determineComputedTheme()).toBe('dark');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
});
