// Run from the work/ folder: node test/theme-black.test.js   (an optional path to theme-black.js may follow)
// Note: the fake get() returns undefined for colorCustomizations on purpose, so code that reads the merged
// value instead of the user layer (inspect().globalValue) fails test 2.
// Tests theme-black.js apply/reset against a fake VS Code settings store with user + workspace layers.
const assert = require('assert');
const Module = require('module');
const store = { user: undefined, workspace: undefined, theme: 'Capella' };
let modalAnswer = 'Reset';
const fakeVscode = {
  ConfigurationTarget: { Global: 1 },
  window: { showWarningMessage: async () => modalAnswer },
  workspace: {
    getConfiguration: () => ({
      inspect: (k) => k === 'colorCustomizations'
        ? { globalValue: clone(store.user), workspaceValue: clone(store.workspace) }
        : { globalValue: store.theme, workspaceValue: store.wsTheme },
      get: (k) => (k === 'colorTheme' ? store.theme : undefined),
      update: async (k, v, target) => { assert.strictEqual(target, 1); store.user = clone(v); },
    }),
  },
};
const orig = Module._load;
Module._load = function (r, ...a) { return r === 'vscode' ? fakeVscode : orig.call(this, r, ...a); };
const path = require('path');
const f = require(path.resolve(process.argv[2] || path.join(__dirname, '..', 'features', 'theme-black.js')));
const { apply } = f._test;
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
function ctx() { const s = {}; return { globalState: { get: (k) => s[k], update: async (k, v) => { s[k] = v; } } }; }
const reset = (c) => f.actions.reset(c);

(async () => {
  // 1. Nothing set -> apply -> reset leaves user settings empty.
  let c = ctx(); store.user = undefined;
  await apply(c, 5);
  assert.strictEqual(store.user['[Capella]']['editor.background'], '#050505');
  assert.strictEqual(store.user['[Capella]']['sideBar.background'], '#0f0f0f');
  assert.strictEqual(await reset(c), 'Reset done.');
  assert.strictEqual(store.user, undefined, 'empty after reset');

  // 2. User's own keys and other themes are kept; workspace values never leak into user settings.
  c = ctx();
  store.user = { '[Capella]': { 'editor.background': '#123456', 'editorCursor.foreground': '#ff0000' }, '[Other]': { a: 1 } };
  store.workspace = { '[Capella]': { 'editor.background': '#999999' }, wsOnly: 1 };
  await apply(c, 3); await apply(c, 10);
  assert.strictEqual(store.user.wsOnly, undefined, 'no workspace leak');
  assert.deepStrictEqual(store.user['[Other]'], { a: 1 });
  assert.strictEqual(store.user['[Capella]']['editorCursor.foreground'], '#ff0000');
  // user edits a non-Capella key between apply and reset: it must survive reset
  store.user['[Capella]']['editorLineNumber.foreground'] = '#00ff00';
  await reset(c);
  assert.deepStrictEqual(store.user['[Capella]'], {
    'editor.background': '#123456', 'editorCursor.foreground': '#ff0000', 'editorLineNumber.foreground': '#00ff00' });
  assert.deepStrictEqual(store.user['[Other]'], { a: 1 });

  // 3. Reset with nothing saved changes nothing.
  c = ctx(); const before = clone(store.user);
  assert.match(await reset(c), /Nothing to reset/);
  assert.deepStrictEqual(store.user, before);

  // 4. Cancelled modal changes nothing.
  c = ctx(); await apply(c, 7); const mid = clone(store.user); modalAnswer = 'Cancel';
  assert.strictEqual(await reset(c), 'Nothing changed.'); assert.deepStrictEqual(store.user, mid); modalAnswer = 'Reset';
  await reset(c);

  // 5. Non-object [Capella] is left alone and reported.
  c = ctx(); store.user = { '[Capella]': 'oops' };
  await assert.rejects(() => apply(c, 2), /not a list of colours/);
  assert.deepStrictEqual(store.user, { '[Capella]': 'oops' });

  // 6. Bad levels are refused.
  for (const bad of [-1, 27, 2.5, '4', null, undefined]) await assert.rejects(() => apply(ctx(), bad));

  // 7. State: custom level and workspace override flags.
  store.user = { '[Capella]': { 'editor.background': '#203040' } }; store.workspace = { '[Capella]': {} };
  const s = f.state(ctx());
  assert.strictEqual(s.level, 'custom'); assert.strictEqual(s.hidden.colours, true); assert.strictEqual(s.canReset, false);
  // 8. A workspace that picks another theme is reported.
  store.wsTheme = 'Default Dark+';
  assert.strictEqual(f.state(ctx()).hidden.theme, true);
  store.wsTheme = undefined;

  // 9. Reset after the user deleted the [Capella] block by hand: nothing is written, undo is cleared.
  c = ctx(); store.user = undefined; store.workspace = undefined;
  await apply(c, 4);
  store.user = { '[Other]': { b: 2 } };
  const hand = clone(store.user);
  assert.strictEqual(await reset(c), 'Reset done.');
  assert.deepStrictEqual(store.user, hand);
  assert.strictEqual(f.state(c).canReset, false);

  // 10. The snapshot keeps the pre-Capella value across several applies.
  c = ctx(); store.user = { '[Capella]': { 'editor.background': '#123456' } };
  await apply(c, 1); await apply(c, 2);
  assert.strictEqual(c.globalState.get(f._test.UNDO_KEY).keys['editor.background'], '#123456');
  console.log('all undo tests passed');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
