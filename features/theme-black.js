// Feature: how black the Capella background is.
// It writes colour overrides that apply ONLY while the Capella theme is active
// (the "[Capella]" block inside workbench.colorCustomizations), so other themes are never touched.
// It reads and writes ONLY the user (global) settings layer, never workspace settings.
'use strict';
const vscode = require('vscode');

const THEME_KEY = '[Capella]';
const UNDO_KEY = 'capella.themeBlack.previous';
const MAX_LEVEL = 26; // 0 = #000000 (pure black) ... 26 = #1a1a1a (soft charcoal)
const PANEL_STEP = 10; // panels are one step lighter than the editor, as in the theme

// Keys that follow the editor background, and keys that follow the panel background.
const EDITOR_KEYS = ['editor.background', 'editorGutter.background', 'tab.activeBackground', 'minimap.background'];
const PANEL_KEYS = [
  'sideBar.background', 'sideBarSectionHeader.background', 'activityBar.background', 'statusBar.background',
  'statusBar.noFolderBackground', 'titleBar.activeBackground', 'titleBar.inactiveBackground', 'panel.background',
  'terminal.background', 'editorGroupHeader.tabsBackground', 'tab.inactiveBackground', 'tab.border',
  'editorWidget.background', 'editorStickyScroll.background',
];
const OWN_KEYS = [...EDITOR_KEYS, ...PANEL_KEYS];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function hex(v) {
  const n = Math.max(0, Math.min(255, v));
  const h = n.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}

function colorsFor(level) {
  const out = {};
  for (const k of EDITOR_KEYS) out[k] = hex(level);
  for (const k of PANEL_KEYS) out[k] = hex(level + PANEL_STEP);
  return out;
}

function workbench() {
  return vscode.workspace.getConfiguration('workbench');
}

// The user layer only (settings.json in the user profile).
function readUser() {
  const i = workbench().inspect('colorCustomizations');
  const v = i && i.globalValue;
  return isObj(v) ? { ...v } : {};
}

async function writeUser(all) {
  await workbench().update('colorCustomizations', Object.keys(all).length ? all : undefined,
    vscode.ConfigurationTarget.Global);
}

// Returns a number 0..MAX, or 'custom' when the user's editor background is not one of ours.
function currentLevel() {
  const block = readUser()[THEME_KEY];
  if (!isObj(block) || block['editor.background'] === undefined) return 0;
  const m = typeof block['editor.background'] === 'string' && /^#([0-9a-f]{2})\1\1$/i.exec(block['editor.background']);
  if (!m) return 'custom';
  const n = parseInt(m[1], 16);
  return n <= MAX_LEVEL ? n : 'custom';
}

// Is the change hidden here by workspace settings?
function hiddenByWorkspace() {
  const c = workbench().inspect('colorCustomizations') || {};
  const t = workbench().inspect('colorTheme') || {};
  const hasBlock = (v) => isObj(v) && v[THEME_KEY] !== undefined;
  const otherTheme = (v) => typeof v === 'string' && v !== 'Capella';
  return {
    colours: hasBlock(c.workspaceValue) || hasBlock(c.workspaceFolderValue),
    theme: otherTheme(t.workspaceValue) || otherTheme(t.workspaceFolderValue),
  };
}

function validLevel(level) {
  return Number.isInteger(level) && level >= 0 && level <= MAX_LEVEL;
}

async function apply(context, level) {
  if (!validLevel(level)) throw new Error('Black level must be a whole number from 0 to ' + MAX_LEVEL + '.');
  const all = readUser();
  const existing = all[THEME_KEY];
  if (existing !== undefined && !isObj(existing)) {
    throw new Error('Your settings have a "[Capella]" colour entry that is not a list of colours, so Capella left it as it is.');
  }
  const block = isObj(existing) ? { ...existing } : {};
  // First change: remember the user's own value for each key Capella will set (null = was not set).
  if (!context.globalState.get(UNDO_KEY)) {
    const keys = {};
    for (const k of OWN_KEYS) keys[k] = Object.prototype.hasOwnProperty.call(block, k) ? block[k] : null;
    await context.globalState.update(UNDO_KEY, { saved: true, keys });
  }
  all[THEME_KEY] = { ...block, ...colorsFor(level) }; // user's other keys are kept
  await writeUser(all);
}

// Returns false when there was nothing to reset.
async function reset(context) {
  const saved = context.globalState.get(UNDO_KEY);
  if (!saved || !saved.saved || !isObj(saved.keys)) return false;
  const all = readUser();
  const existing = all[THEME_KEY];
  if (isObj(existing)) {
    const block = { ...existing };
    for (const k of OWN_KEYS) {
      const old = saved.keys[k];
      if (old === null || old === undefined) delete block[k];
      else block[k] = old;
    }
    if (Object.keys(block).length) all[THEME_KEY] = block; else delete all[THEME_KEY];
    await writeUser(all);
  }
  await context.globalState.update(UNDO_KEY, undefined);
  return true;
}

module.exports = {
  id: 'themeBlack',
  title: 'Theme',
  state: (context) => ({
    level: currentLevel(),
    max: MAX_LEVEL,
    panelStep: PANEL_STEP,
    active: workbench().get('colorTheme') === 'Capella',
    canReset: !!(context && context.globalState.get(UNDO_KEY)),
    hidden: hiddenByWorkspace(),
  }),
  actions: {
    apply: async (context, payload) => {
      await apply(context, payload && payload.level);
      return 'Applied.';
    },
    reset: async (context) => {
      const pick = await vscode.window.showWarningMessage(
        'Reset the Capella background to what it was before Capella changed it?', { modal: true }, 'Reset');
      if (pick !== 'Reset') return 'Nothing changed.';
      return (await reset(context)) ? 'Reset done.' : 'Nothing to reset: Capella has not changed your colours.';
    },
  },
  _test: { colorsFor, hex, validLevel, apply, reset, OWN_KEYS, THEME_KEY, UNDO_KEY },
};
