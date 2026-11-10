// Run from the work/ folder: node test/fonts.test.js
// Tests features/fonts.js against a fake VS Code (user + default settings) and a fake download, in a temp folder.
'use strict';
const assert = require('assert');
const Module = require('module');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const user = {};
const defaults = { 'editor.fontSize': 12, 'editor.lineHeight': 0, 'editor.letterSpacing': 0 };
let answer = 'Apply';
const writes = [];
const fakeVscode = {
  ConfigurationTarget: { Global: 1 },
  window: { showWarningMessage: async () => answer },
  workspace: {
    getConfiguration: () => ({
      inspect: (k) => ({ globalValue: user[k], defaultValue: defaults[k] }),
      get: (k) => (k in user ? user[k] : defaults[k]),
      update: async (k, v, target) => {
        assert.strictEqual(target, 1, 'only user settings');
        writes.push(k);
        if (v === undefined) delete user[k]; else user[k] = v;
      },
    }),
  },
};
const orig = Module._load;
Module._load = function (r, ...a) { return r === 'vscode' ? fakeVscode : orig.call(this, r, ...a); };
const f = require(path.join(__dirname, '..', 'features', 'fonts.js'));
const T = f._test;
const ctx = () => { const s = {}; return { globalState: { get: (k) => s[k], update: async (k, v) => { s[k] = v; } } }; };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capella-fonts-'));
T.setFontDir(dir);
// Fake download: serves bytes whose fingerprint we control.
const served = {};
T.setFetch(async (url) => {
  assert.ok(url.startsWith(T.BASE), 'only the pinned source');
  if (!(url in served)) throw new Error('unexpected url ' + url);
  return served[url];
});
// Make the pinned fingerprints match fake files for the test font.
const font = T.FONTS.jetbrains;
for (const file of font.files) {
  const buf = crypto.randomBytes(64);
  file.size = buf.length; file.sha256 = T.sha256(buf);
  served[T.BASE + file.remote] = buf;
}

(async () => {
  // 1. Bad payloads are refused.
  for (const bad of [undefined, {}, { font: 'nope' }, { font: '__proto__' }, { font: 'toString' }]) {
    await assert.rejects(() => f.actions.install(ctx(), bad), /Unknown font/);
  }
  for (const bad of [undefined, { level: 'huge' }, { level: 'constructor' }]) {
    await assert.rejects(() => f.actions.comfort(ctx(), bad), /Unknown comfort level/);
  }

  // 2. Cancelled install writes nothing.
  answer = 'Cancel';
  assert.strictEqual(await f.actions.install(ctx(), { font: 'jetbrains' }), 'Nothing changed.');
  assert.deepStrictEqual(fs.readdirSync(dir), []);
  answer = 'Install';

  // 3. A wrong fingerprint stops the install before any file is written.
  const good = served[T.BASE + font.files[1].remote];
  served[T.BASE + font.files[1].remote] = Buffer.alloc(good.length, 1);
  await assert.rejects(() => f.actions.install(ctx(), { font: 'jetbrains' }), /fingerprint/);
  assert.deepStrictEqual(fs.readdirSync(dir), [], 'nothing written on bad file');
  // Wrong size too.
  served[T.BASE + font.files[1].remote] = Buffer.concat([good, Buffer.from('x')]);
  await assert.rejects(() => f.actions.install(ctx(), { font: 'jetbrains' }), /wrong size/);
  assert.deepStrictEqual(fs.readdirSync(dir), []);
  served[T.BASE + font.files[1].remote] = good;

  // 4. Good install writes exactly the two files, and a second install does nothing.
  assert.match(await f.actions.install(ctx(), { font: 'jetbrains' }), /installed \(2 files/);
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), font.files.map((x) => x.local).sort());
  assert.match(await f.actions.install(ctx(), { font: 'jetbrains' }), /already installed/);

  // 5. A file with the exact target name (an incomplete earlier install) is never overwritten.
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'capella-fonts-'));
  T.setFontDir(dir2);
  const casc = T.FONTS.cascadia;
  for (const file of casc.files) { const b = crypto.randomBytes(32); file.size = b.length; file.sha256 = T.sha256(b); served[T.BASE + file.remote] = b; }
  const target = path.join(dir2, casc.files[1].local);
  fs.writeFileSync(target, 'users own');
  assert.strictEqual(f.state(ctx()).fonts.find((x) => x.id === 'cascadia').installed, false, 'half install is not "installed"');
  await assert.rejects(() => f.actions.install(ctx(), { font: 'cascadia' }), /will not overwrite/);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'users own');
  assert.deepStrictEqual(fs.readdirSync(dir2), [casc.files[1].local], 'nothing else written');

  // 5b. A failure in the middle of an install removes everything that run created.
  fs.renameSync(target, path.join(dir2, 'moved-away.txt'));
  const realLink = fs.promises.link; let calls = 0;
  fs.promises.link = async (...a) => { if (++calls === 2) throw new Error('disk full'); return realLink(...a); };
  await assert.rejects(() => f.actions.install(ctx(), { font: 'cascadia' }), /nothing was left behind: disk full/);
  fs.promises.link = realLink;
  assert.deepStrictEqual(fs.readdirSync(dir2), ['moved-away.txt'], 'no half font, no temp files');
  assert.match(await f.actions.install(ctx(), { font: 'cascadia' }), /installed \(2 files/);
  T.setFontDir(dir);

  // 6. Use font: only after install; changes only managed keys; undo restores.
  answer = 'Apply';
  const c = ctx();
  user['editor.fontFamily'] = 'Menlo';
  await assert.rejects(() => f.actions.useFont(c, { font: 'cascadia' }), /not installed/);
  writes.length = 0;
  assert.strictEqual(await f.actions.useFont(c, { font: 'jetbrains' }), 'Applied.');
  assert.deepStrictEqual(writes.sort(), ['editor.fontFamily', 'editor.fontLigatures', 'terminal.integrated.fontFamily']);
  assert.ok(user['editor.fontFamily'].startsWith("'JetBrains Mono'"));
  assert.strictEqual(f.state(c).fonts.find((x) => x.id === 'jetbrains').inUse, true);

  // 7. Comfort + calm, then the user edits one key by hand; undo keeps that edit and restores the rest.
  assert.strictEqual(await f.actions.comfort(c, { level: 'spacious' }), 'Applied.');
  assert.strictEqual(f.state(c).level, 'spacious');
  assert.strictEqual(await f.actions.calm(c), 'Applied.');
  assert.strictEqual(f.state(c).calm, true);
  assert.strictEqual(await f.actions.calm(c), 'Already set.');
  user['editor.fontSize'] = 18; // the user's own later change
  answer = 'Cancel';
  assert.strictEqual(await f.actions.undo(c), 'Nothing changed.');
  answer = 'Undo';
  const msg = await f.actions.undo(c);
  assert.match(msg, /Kept your own later changes: editor.fontSize/);
  assert.strictEqual(user['editor.fontFamily'], 'Menlo', 'old value back');
  assert.strictEqual(user['editor.fontSize'], 18, 'own change kept');
  for (const k of ['editor.fontLigatures', 'editor.lineHeight', 'editor.minimap.enabled', 'editor.padding.top']) {
    assert.ok(!(k in user), k + ' back to default');
  }
  assert.strictEqual(f.state(c).canUndo, false);
  assert.strictEqual(await f.actions.undo(c), 'Nothing to undo.');

  // 8. The snapshot keeps the pre-Capella value across several changes.
  const c2 = ctx(); answer = 'Apply'; user['editor.fontSize'] = 11;
  await f.actions.comfort(c2, { level: 'compact' }); await f.actions.comfort(c2, { level: 'spacious' });
  answer = 'Undo'; await f.actions.undo(c2);
  assert.strictEqual(user['editor.fontSize'], 11);

  // 9. Only the exact pinned source is allowed.
  const ok = T.BASE + 'cascadiacode/CascadiaCode%5Bwght%5D.ttf';
  assert.ok(T.assertAllowedUrl(ok));
  const other = 'https://raw.githubusercontent.com/google/fonts/';
  for (const bad of [
    ok.replace('https:', 'http:'),
    ok.replace('raw.githubusercontent.com', 'evil.example.com'),
    ok.replace('raw.githubusercontent.com', 'raw.githubusercontent.com.evil.com'),
    ok.replace('raw.githubusercontent.com', 'raw.githubusercontent.com:8443'),
    ok.replace('https://', 'https://user:pw@'),
    other + 'main/ofl/cascadiacode/x.ttf',
    other + T.COMMIT + '/ofl/../../../evil/x.ttf',
    other + T.COMMIT + '/ofl/%2e%2e/%2e%2e/evil.ttf',
    other + T.COMMIT + '/ofl/a%2Fb.ttf',
    ok + '?x=1', ok + '#x', 'not a url', '',
  ]) assert.throws(() => T.assertAllowedUrl(bad), /Blocked/, bad);
  console.log('all fonts tests passed');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
