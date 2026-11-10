// The Capella settings window that opens from the star icon in the sidebar.
// Safety: a strict Content Security Policy (no outside content, only our own script with a one-time nonce),
// and every message from the window is checked against a fixed list before anything runs.
'use strict';
const vscode = require('vscode');
const crypto = require('crypto');

class CapellaPanel {
  constructor(context, features) {
    this.context = context;
    this.features = features;
    this.view = undefined;
  }

  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [] };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage((msg) => {
      this.onMessage(msg).catch((e) => vscode.window.showErrorMessage('Capella: ' + (e && e.message ? e.message : String(e))));
    }, undefined, this.context.subscriptions);
    view.onDidChangeVisibility(() => { if (view.visible) this.sendState(); }, undefined, this.context.subscriptions);
    view.onDidDispose(() => { if (this.view === view) this.view = undefined; }, undefined, this.context.subscriptions);
  }

  post(message) {
    if (this.view) this.view.webview.postMessage(message).then(undefined, () => {});
  }

  sendState() {
    if (!this.view) return;
    const state = {};
    for (const f of this.features) {
      try { state[f.id] = f.state(this.context); } catch (e) { state[f.id] = { error: String(e.message || e) }; }
    }
    this.post({ type: 'state', state });
  }

  async onMessage(msg) {
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
    if (msg.type === 'ready') return this.sendState();
    if (msg.type === 'openSettingsJson') {
      await vscode.commands.executeCommand('workbench.action.openSettingsJson');
      return;
    }
    if (msg.type !== 'action') return;
    const feature = this.features.find((f) => f.id === msg.feature);
    if (!feature || typeof msg.action !== 'string' || !Object.prototype.hasOwnProperty.call(feature.actions, msg.action)) {
      return;
    }
    try {
      const status = await feature.actions[msg.action](this.context, msg.payload);
      this.post({ type: 'status', feature: feature.id, text: typeof status === 'string' ? status : 'Done.' });
    } catch (e) {
      const text = e && e.message ? e.message : String(e);
      this.post({ type: 'status', feature: feature.id, text, error: true });
      vscode.window.showErrorMessage('Capella: ' + text);
    }
    this.sendState();
  }

  html(webview) {
    const nonce = crypto.randomBytes(16).toString('base64');
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'nonce-${nonce}'`,
      `script-src 'nonce-${nonce}'`,
    ].join('; ');
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="${nonce}">
  :root { --text:#e6e6e3; --dim:#939293; --line:#222; }
  body { color: var(--vscode-foreground, var(--text)); font-family: var(--vscode-font-family); font-size: 13px; padding: 4px 10px 16px; }
  h2 { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--dim); margin: 18px 0 8px; font-weight: 600; }
  section { border-bottom: 1px solid var(--line); padding-bottom: 14px; }
  p { color: var(--dim); margin: 4px 0 10px; line-height: 1.5; }
  .soon { opacity: .55 }
  .tag { font-size: 10px; border: 1px solid #333; border-radius: 10px; padding: 1px 7px; color: var(--dim); margin-left: 6px; }
  h3 { font-size: 12px; margin: 14px 0 6px; font-weight: 600; }
  .font { border: 1px solid var(--line); border-radius: 6px; padding: 8px; margin: 6px 0; }
  .font b { font-weight: 600; }
  .font small { display: block; color: var(--dim); margin: 3px 0 6px; line-height: 1.4; }
  .ok { color: #a3d27a; font-size: 11px; margin-left: 6px; }
  .row { display: flex; flex-wrap: wrap; gap: 6px; }
  button { background: var(--vscode-button-secondaryBackground, #2a2a2a); color: var(--vscode-button-secondaryForeground, #eee);
    border: 1px solid #444; border-radius: 4px; padding: 4px 10px; cursor: pointer; font: inherit; }
  button:hover { filter: brightness(1.2); }
  button.on { border-color: #ffb454; color: #ffb454; }
  button:disabled { opacity: .45; cursor: default; filter: none; }
  .status { font-size: 12px; color: #a3d27a; min-height: 1em; margin: 8px 0 0; }
  .status.err { color: #ff6b5e; }
</style></head>
<body>
  <section>
    <h2>Fonts and Readability</h2>
    <h3>Font</h3>
    <p id="unsupported" hidden>Automatic font install works on macOS and Linux.</p>
    <div id="fonts"></div>
    <h3>Reading comfort</h3>
    <p>Text size, line spacing and letter spacing together.</p>
    <div class="row" id="levels"></div>
    <h3>Calm view</h3>
    <p>Hides the minimap, grey inline hints (hold Ctrl+Option on Mac, Ctrl+Alt elsewhere, to see them), breadcrumbs and indent lines, and adds space above the code.</p>
    <div class="row"><button id="calm">Turn on Calm view</button></div>
    <h3>Undo</h3>
    <div class="row"><button id="undo">Undo all font and readability changes</button></div>
    <p class="status" id="status" role="status" aria-live="polite"></p>
  </section>
  <section class="soon"><h2>Icons <span class="tag">coming in 1.4</span></h2><p>File icons in Capella's colours.</p></section>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const LEVELS = [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['spacious', 'Spacious']];
  const act = (action, payload) => vscode.postMessage({ type: 'action', feature: 'fonts', action, payload });
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
  const statusEl = document.getElementById('status');
  document.getElementById('calm').addEventListener('click', () => act('calm'));
  document.getElementById('undo').addEventListener('click', () => act('undo'));
  const levels = document.getElementById('levels');
  for (const [id, label] of LEVELS) {
    const b = el('button', label); b.dataset.level = id;
    b.addEventListener('click', () => act('comfort', { level: id }));
    levels.appendChild(b);
  }
  function render(s) {
    document.getElementById('unsupported').hidden = !!s.supported;
    const box = document.getElementById('fonts');
    box.replaceChildren();
    for (const f of (Array.isArray(s.fonts) ? s.fonts : [])) {
      const card = el('div', '', 'font');
      card.appendChild(el('b', String(f.name)));
      if (f.inUse) card.appendChild(el('span', 'in use', 'ok'));
      else if (f.installed) card.appendChild(el('span', 'installed', 'ok'));
      card.appendChild(el('small', String(f.about)));
      const row = el('div', '', 'row');
      const ins = el('button', f.installed ? 'Installed' : 'Install');
      ins.disabled = !!f.installed || !s.supported;
      ins.addEventListener('click', () => act('install', { font: f.id }));
      const use = el('button', f.inUse ? 'In use' : 'Use');
      use.disabled = !f.installed || !!f.inUse;
      if (f.inUse) use.className = 'on';
      use.addEventListener('click', () => act('useFont', { font: f.id }));
      row.append(ins, use); card.appendChild(row); box.appendChild(card);
    }
    for (const b of levels.children) b.className = b.dataset.level === s.level ? 'on' : '';
    const calm = document.getElementById('calm');
    calm.textContent = s.calm ? 'Calm view is on' : 'Turn on Calm view';
    calm.disabled = !!s.calm; calm.className = s.calm ? 'on' : '';
    document.getElementById('undo').disabled = !s.canUndo;
  }
  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!m || typeof m !== 'object') return;
    if (m.type === 'status' && typeof m.text === 'string') {
      statusEl.textContent = m.text; statusEl.className = m.error ? 'status err' : 'status'; return;
    }
    if (m.type !== 'state' || !m.state || !m.state.fonts) return;
    if (m.state.fonts.error) { statusEl.textContent = 'Could not read font settings: ' + String(m.state.fonts.error); statusEl.className = 'status err'; return; }
    render(m.state.fonts);
  });
  vscode.postMessage({ type: 'ready' });
</script>
</body></html>`;
  }
}

module.exports = { CapellaPanel };
