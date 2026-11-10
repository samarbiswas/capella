// Capella Fonts and Readability: install a recommended coding font and set calm, readable editor settings.
// Safety:
// - Fonts come only from Google Fonts' official GitHub repository, pinned to one exact commit, over HTTPS,
//   from one allowed host, with a size cap and a timeout. Every file must match its pinned SHA-256
//   fingerprint and size before anything is written. Existing font files are never overwritten.
// - Settings are changed only in your user settings, only after you confirm, and the value you had before
//   Capella first changed each one is kept so Undo can put it back. Undo never overwrites a value you
//   changed yourself afterwards.
'use strict';
const vscode = require('vscode');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

// Pinned source: google/fonts main at 2026-11-10 (`gh api repos/google/fonts/commits/main`). Sizes and SHA-256
// values were measured on the downloaded files with `stat -f%z` and `shasum -a 256` (see work/fonts-pins.md).
const COMMIT = '5bb28733cec313b63fbd415b574b5ae35c8aa8b8';
const HOST = 'raw.githubusercontent.com';
const BASE = `https://${HOST}/google/fonts/${COMMIT}/ofl/`;
const MAX_BYTES = 2 * 1024 * 1024;
const UNDO_KEY = 'capella.fonts.previous';

const FONTS = {
  cascadia: {
    name: 'Cascadia Code',
    family: "'Cascadia Code', Menlo, Consolas, monospace",
    prefix: 'CascadiaCode',
    about: 'Clean, with a handwriting-style italic made for code. Best match for Capella.',
    files: [
      { remote: 'cascadiacode/CascadiaCode%5Bwght%5D.ttf', local: 'CascadiaCode[wght].ttf', size: 727940,
        sha256: '30f2e14a5c389b346b1fce110c4ddcf0dc5ce8265faf5eca2ab7323f49dba590' },
      { remote: 'cascadiacode/CascadiaCode-Italic%5Bwght%5D.ttf', local: 'CascadiaCode-Italic[wght].ttf', size: 530444,
        sha256: '33559b4beb60523b824e25a416b5de2779a9bc7c7ce32ce128490b42acbf4681' },
    ],
  },
  jetbrains: {
    name: 'JetBrains Mono',
    family: "'JetBrains Mono', Menlo, Consolas, monospace",
    prefix: 'JetBrainsMono',
    about: 'Very clear letters with tall lowercase; its italic is only slanted.',
    files: [
      { remote: 'jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf', local: 'JetBrainsMono[wght].ttf', size: 187208,
        sha256: '48715a42ec242c21e9f02692891e147d022299a52e48d5e413e1a942193ffeda' },
      { remote: 'jetbrainsmono/JetBrainsMono-Italic%5Bwght%5D.ttf', local: 'JetBrainsMono-Italic[wght].ttf', size: 191556,
        sha256: '85ae2a5cd3f56baf1ce1c21a851322c58e3d8fbe8e8ad4a4d090a820dd7fe558' },
    ],
  },
};

const LEVELS = {
  compact: { label: 'Compact', values: { 'editor.fontSize': 13, 'editor.lineHeight': 1.45, 'editor.letterSpacing': 0 } },
  comfortable: { label: 'Comfortable', values: { 'editor.fontSize': 14, 'editor.lineHeight': 1.6, 'editor.letterSpacing': 0.2 } },
  spacious: { label: 'Spacious', values: { 'editor.fontSize': 15, 'editor.lineHeight': 1.75, 'editor.letterSpacing': 0.3 } },
};

const CALM = {
  'editor.minimap.enabled': false,
  'editor.inlayHints.enabled': 'offUnlessPressed',
  'breadcrumbs.enabled': false,
  'editor.guides.indentation': false,
  'editor.padding.top': 16,
};

// Every setting this feature may touch. Nothing outside this list is ever written.
const MANAGED = new Set([
  'editor.fontFamily', 'editor.fontLigatures', 'terminal.integrated.fontFamily',
  ...Object.keys(LEVELS.compact.values), ...Object.keys(CALM),
]);

let fontDirOverride; // tests only
let fetchOverride; // tests only

function fontDirs() {
  if (fontDirOverride) return [fontDirOverride];
  const home = os.homedir();
  if (process.platform === 'darwin') return [path.join(home, 'Library', 'Fonts'), '/Library/Fonts'];
  if (process.platform === 'linux') return [path.join(home, '.local', 'share', 'fonts'), '/usr/share/fonts', '/usr/local/share/fonts'];
  return [];
}
const installDir = () => fontDirs()[0];

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

// Our own install: every exact file name present in our install folder.
function ownInstall(font) {
  const dir = installDir();
  return !!dir && font.files.every((f) => fs.existsSync(path.join(dir, f.local)));
}

// Installed by us, or installed another way (for example Homebrew or the font's own installer).
function isInstalled(font) {
  if (ownInstall(font)) return true;
  for (const dir of fontDirs()) {
    try {
      const names = fs.readdirSync(dir);
      if (names.some((n) => n.startsWith(font.prefix) && /\.(ttf|otf)$/i.test(n) && !font.files.some((f) => f.local === n))) return true;
    } catch (_) { /* folder missing: not installed there */ }
  }
  return false;
}

// Throws unless the address is exactly the pinned official source.
function assertAllowedUrl(url) {
  let u;
  try { u = new URL(url); } catch (_) { throw new Error('Blocked: bad font address.'); }
  if (u.protocol !== 'https:' || u.hostname !== HOST || u.port !== '' || u.username || u.password || u.search || u.hash
      || !u.pathname.startsWith(`/google/fonts/${COMMIT}/ofl/`) || /%2e|%2f|%5c/i.test(u.pathname)) {
    throw new Error('Blocked: not the official, pinned font source.');
  }
  return u;
}

function fetchBytes(url, expectedSize) {
  if (fetchOverride) return fetchOverride(url);
  return new Promise((resolve, reject) => {
    let u;
    try { u = assertAllowedUrl(url); } catch (e) { return reject(e); }
    const req = https.get(u, { timeout: 30000, headers: { 'User-Agent': 'capella-vscode' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`Download failed (HTTP ${res.statusCode}).`)); }
      const len = Number(res.headers['content-length']);
      if (len && expectedSize && len !== expectedSize) { req.destroy(new Error('Download has the wrong size, so it was stopped.')); return; }
      const chunks = [];
      let n = 0;
      res.on('data', (c) => {
        n += c.length;
        if (n > MAX_BYTES) req.destroy(new Error('Download is larger than expected, so it was stopped.'));
        else chunks.push(c);
      });
      res.on('end', () => { if (n <= MAX_BYTES) resolve(Buffer.concat(chunks)); });
      res.on('error', reject);
    });
    const total = setTimeout(() => req.destroy(new Error('Download took too long, so it was stopped.')), 60000);
    req.on('close', () => clearTimeout(total));
    req.on('timeout', () => req.destroy(new Error('Download timed out.')));
    req.on('error', reject);
  });
}

function checkFile(file, buf) {
  if (!Buffer.isBuffer(buf)) throw new Error(`${file.local}: download did not return a file.`);
  if (buf.length !== file.size) throw new Error(`${file.local}: wrong size, so nothing was installed.`);
  if (sha256(buf) !== file.sha256) throw new Error(`${file.local}: fingerprint does not match, so nothing was installed.`);
}

function pickFont(payload) {
  const id = payload && typeof payload.font === 'string' ? payload.font : '';
  if (!Object.prototype.hasOwnProperty.call(FONTS, id)) throw new Error('Unknown font.');
  return FONTS[id];
}

async function install(context, payload) {
  const font = pickFont(payload);
  const dir = installDir();
  if (!dir) {
    throw new Error(`Automatic install works on macOS and Linux. On Windows, download ${font.name} from its website and double-click the font file.`);
  }
  if (isInstalled(font)) return `${font.name} is already installed.`;
  const taken = font.files.filter((f) => fs.existsSync(path.join(dir, f.local)));
  if (taken.length) {
    throw new Error(`A file named ${taken[0].local} is already in ${dir} but the font is incomplete. Capella will not overwrite it; remove or rename it and try again.`);
  }
  const mb = (font.files.reduce((s, f) => s + f.size, 0) / 1048576).toFixed(1);
  const ok = await vscode.window.showWarningMessage(
    `Install ${font.name}?`,
    { modal: true, detail: `Downloads ${font.files.length} files (${mb} MB) from Google Fonts' official GitHub, checks each file's fingerprint, and copies them to ${dir}. Your other fonts are not touched.` },
    'Install');
  if (ok !== 'Install') return 'Nothing changed.';
  const bufs = [];
  for (const f of font.files) {
    const buf = await fetchBytes(BASE + f.remote, f.size);
    checkFile(f, buf);
    bufs.push(buf);
  }
  await fs.promises.mkdir(dir, { recursive: true });
  // Write each file under a temporary name, then link it to its real name (link never overwrites).
  // If anything fails, remove every file this run created, so no broken half-font is left behind.
  const created = [];
  try {
    for (let i = 0; i < font.files.length; i++) {
      const dest = path.join(dir, font.files[i].local);
      const tmp = path.join(dir, `.capella-${crypto.randomBytes(6).toString('hex')}.tmp`);
      await fs.promises.writeFile(tmp, bufs[i], { flag: 'wx', mode: 0o644 });
      created.push(tmp);
      await fs.promises.link(tmp, dest);
      created.push(dest);
      await fs.promises.unlink(tmp);
      created.splice(created.indexOf(tmp), 1);
    }
  } catch (e) {
    for (const p of created) await fs.promises.unlink(p).catch(() => {});
    throw new Error(`Install stopped, nothing was left behind: ${e.message}`);
  }
  if (process.platform === 'linux' && !fontDirOverride) execFile('fc-cache', ['-f', dir], () => {});
  const quit = process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q';
  return `${font.name} installed (${font.files.length} files; each matched its official fingerprint, a check that the file is exactly the published one). Quit VS Code fully (${quit}) and open it again, then click Use.`;
}

// ---- settings with undo ----
const cfg = () => vscode.workspace.getConfiguration();
const userValue = (key) => cfg().inspect(key)?.globalValue;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function change(context, title, values) {
  const keys = Object.keys(values);
  for (const k of keys) if (!MANAGED.has(k)) throw new Error(`Capella does not change ${k}.`);
  const lines = keys.filter((k) => !same(userValue(k), values[k]))
    .map((k) => `${k}: ${userValue(k) === undefined ? '(default)' : JSON.stringify(userValue(k))} → ${JSON.stringify(values[k])}`);
  if (!lines.length) return 'Already set.';
  const ok = await vscode.window.showWarningMessage(title, { modal: true, detail: lines.join('\n') + '\n\nUndo puts your old values back.' }, 'Apply');
  if (ok !== 'Apply') return 'Nothing changed.';
  const store = context.globalState.get(UNDO_KEY) || {};
  for (const k of keys) {
    const before = userValue(k);
    if (!Object.prototype.hasOwnProperty.call(store, k)) store[k] = { had: before !== undefined, value: before };
    store[k].wrote = values[k];
  }
  await context.globalState.update(UNDO_KEY, store);
  for (const k of keys) await cfg().update(k, values[k], vscode.ConfigurationTarget.Global);
  return 'Applied.';
}

async function useFont(context, payload) {
  const font = pickFont(payload);
  if (!isInstalled(font)) throw new Error(`${font.name} is not installed yet. Click Install first.`);
  return change(context, `Use ${font.name} in the editor and terminal?`, {
    'editor.fontFamily': font.family, 'editor.fontLigatures': true, 'terminal.integrated.fontFamily': font.family,
  });
}

async function comfort(context, payload) {
  const id = payload && typeof payload.level === 'string' ? payload.level : '';
  if (!Object.prototype.hasOwnProperty.call(LEVELS, id)) throw new Error('Unknown comfort level.');
  return change(context, `Set reading comfort to ${LEVELS[id].label}?`, LEVELS[id].values);
}

async function calm(context) {
  return change(context, 'Turn on Calm view (hide minimap, inline hints, breadcrumbs and indent lines)?', CALM);
}

async function undo(context) {
  const store = context.globalState.get(UNDO_KEY);
  if (!store || typeof store !== 'object' || !Object.keys(store).length) return 'Nothing to undo.';
  const ok = await vscode.window.showWarningMessage('Undo Capella font and readability changes?',
    { modal: true, detail: 'Puts back the values you had before Capella changed them. Settings you changed yourself since then are kept.' }, 'Undo');
  if (ok !== 'Undo') return 'Nothing changed.';
  const kept = [];
  for (const [k, s] of Object.entries(store)) {
    if (!MANAGED.has(k)) continue;
    if (!same(userValue(k), s.wrote)) { kept.push(k); continue; }
    await cfg().update(k, s.had ? s.value : undefined, vscode.ConfigurationTarget.Global);
  }
  await context.globalState.update(UNDO_KEY, undefined);
  return kept.length ? `Undone. Kept your own later changes: ${kept.join(', ')}.` : 'Undone.';
}

function state(context) {
  const now = (k) => cfg().get(k);
  let level = 'custom';
  for (const [id, l] of Object.entries(LEVELS)) if (Object.entries(l.values).every(([k, v]) => same(now(k), v))) level = id;
  const family = String(now('editor.fontFamily') || '');
  const store = context.globalState.get(UNDO_KEY);
  return {
    supported: !!installDir(),
    fonts: Object.entries(FONTS).map(([id, f]) => ({
      id, name: f.name, about: f.about, installed: isInstalled(f), inUse: family.startsWith(`'${f.name}'`) || family.startsWith(f.name),
    })),
    level,
    calm: Object.entries(CALM).every(([k, v]) => same(now(k), v)),
    canUndo: !!(store && Object.keys(store).length),
  };
}

module.exports = {
  id: 'fonts',
  title: 'Fonts and Readability',
  watches: [...MANAGED],
  state,
  actions: { install, useFont, comfort, calm, undo },
  _test: {
    FONTS, LEVELS, CALM, UNDO_KEY, BASE, COMMIT, checkFile, sha256, assertAllowedUrl,
    setFontDir: (d) => { fontDirOverride = d; }, setFetch: (f) => { fetchOverride = f; },
  },
};
