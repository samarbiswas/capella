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
  :root { --gold:#d4b866; --text:#e6e6e3; --dim:#939293; --line:#222; --soft:#f2f2ef; }
  body { color: var(--vscode-foreground, var(--text)); font-family: var(--vscode-font-family); font-size: 13px; padding: 4px 10px 16px; }
  h2 { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--dim); margin: 18px 0 8px; font-weight: 600; }
  section { border-bottom: 1px solid var(--line); padding-bottom: 14px; }
  p { color: var(--dim); margin: 4px 0 10px; line-height: 1.5; }
  .row { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
  input[type=range] { flex: 1; accent-color: var(--gold); }
  .value { min-width: 64px; text-align: right; font-family: var(--vscode-editor-font-family); color: var(--soft); }
  .preview { display: flex; height: 54px; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; margin: 8px 0; }
  .preview .side { width: 34%; }
  .preview .ed { flex: 1; padding: 8px; font-family: var(--vscode-editor-font-family); font-size: 11px; line-height: 1.4; }
  .k { color:#f0708f; font-style: italic } .f { color:#a3d27a } .s { color:#d4b866 } .g { color:#939293 }
  button { background: #1f1f1f; color: var(--soft); border: 1px solid #333; border-radius: 4px; padding: 5px 12px; cursor: pointer; font: inherit; }
  button:hover { background: #333; }
  button.primary { border-color: var(--gold); color: var(--gold); }
  .note { font-size: 12px; color: #f09a6e; }
  .status { font-size: 12px; color: #a3d27a; min-height: 1em; margin: 2px 0; }
  .status.err { color: #ff5f6d; }
  button:disabled { opacity: .45; cursor: default; }
  .soon { opacity: .55 }
  .tag { font-size: 10px; border: 1px solid #333; border-radius: 10px; padding: 1px 7px; color: var(--dim); margin-left: 6px; }
  a { color: #7ccfdb; cursor: pointer; }
</style></head>
<body>
  <section id="theme">
    <h2>Theme</h2>
    <p>How black the background is. 0 is pure black (best on OLED and in dark rooms); higher is a softer charcoal. Panels stay one step lighter.</p>
    <div class="row">
      <input id="level" type="range" min="0" max="26" step="1" value="0" aria-label="Black level">
      <span class="value" id="levelHex">#000000</span>
    </div>
    <div class="preview" aria-hidden="true">
      <div class="side" id="pvSide"></div>
      <div class="ed" id="pvEd"><span class="k">def</span> <span class="f">total</span><span class="g">(</span>items<span class="g">):</span><br>&nbsp;&nbsp;<span class="k">return</span> <span class="s">"ready"</span></div>
    </div>
    <div class="row">
      <button class="primary" id="apply">Apply</button>
      <button id="reset">Reset</button>
    </div>
    <p class="status" id="status" role="status" aria-live="polite"></p>
    <p class="note" id="custom" hidden>Your settings already hold your own Capella background colour, so the slider starts at 0. Apply replaces it; Reset brings it back.</p>
    <p class="note" id="notActive" hidden>Capella is not your active colour theme, so you will not see this change until you choose Capella (Cmd+K Cmd+T).</p>
    <p class="note" id="hiddenColours" hidden>This workspace has its own Capella colours in its settings, so your change may be partly or fully hidden in this window.</p>
    <p class="note" id="hiddenTheme" hidden>This workspace chooses a different colour theme in its settings, so you will not see Capella here.</p>
    <p>Saved in your user settings under <code>workbench.colorCustomizations → [Capella]</code>, so other themes are not affected. Workspace settings can override it. <a id="openJson">Open settings.json</a></p>
  </section>
  <section class="soon"><h2>Fonts <span class="tag">coming in 1.3</span></h2><p>Install a recommended font and apply font settings, with undo.</p></section>
  <section class="soon"><h2>Agentic Workspace <span class="tag">coming in 1.4</span></h2><p>Create a minimal starter: AGENTS.md, CLAUDE.md, TASKS.md and a few folders.</p></section>
  <section class="soon"><h2>Icons <span class="tag">coming in 1.5</span></h2><p>File icons in Capella's colours.</p></section>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const level = document.getElementById('level');
  const hexOut = document.getElementById('levelHex');
  const side = document.getElementById('pvSide');
  const ed = document.getElementById('pvEd');
  const notActive = document.getElementById('notActive');
  const custom = document.getElementById('custom');
  const hiddenColours = document.getElementById('hiddenColours');
  const hiddenTheme = document.getElementById('hiddenTheme');
  const statusEl = document.getElementById('status');
  const resetBtn = document.getElementById('reset');
  let step = 10;
  const hx = (v) => { const h = Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'); return '#' + h + h + h; };
  function paint() {
    const v = Number(level.value);
    hexOut.textContent = hx(v);
    ed.style.background = hx(v);
    side.style.background = hx(v + step);
  }
  level.addEventListener('input', paint);
  document.getElementById('apply').addEventListener('click', () =>
    vscode.postMessage({ type: 'action', feature: 'themeBlack', action: 'apply', payload: { level: Number(level.value) } }));
  document.getElementById('reset').addEventListener('click', () =>
    vscode.postMessage({ type: 'action', feature: 'themeBlack', action: 'reset' }));
  document.getElementById('openJson').addEventListener('click', () => vscode.postMessage({ type: 'openSettingsJson' }));
  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!m || typeof m !== 'object') return;
    if (m.type === 'status' && typeof m.text === 'string') {
      statusEl.textContent = m.text;
      statusEl.className = m.error ? 'status err' : 'status';
      return;
    }
    if (m.type !== 'state' || !m.state || !m.state.themeBlack) return;
    const s = m.state.themeBlack;
    if (typeof s.panelStep === 'number') step = s.panelStep;
    if (typeof s.max === 'number') level.max = String(s.max);
    const max = Number(level.max);
    if (typeof s.level === 'number') level.value = String(Math.max(0, Math.min(max, s.level)));
    else if (s.level === 'custom') level.value = '0';
    custom.hidden = s.level !== 'custom';
    notActive.hidden = !!s.active;
    hiddenColours.hidden = !(s.hidden && s.hidden.colours);
    hiddenTheme.hidden = !(s.hidden && s.hidden.theme);
    resetBtn.disabled = !s.canReset;
    paint();
  });
  paint();
  vscode.postMessage({ type: 'ready' });
</script>
</body></html>`;
  }
}

module.exports = { CapellaPanel };
