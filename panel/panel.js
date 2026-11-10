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
</style></head>
<body>
  <section class="soon"><h2>Fonts <span class="tag">coming in 1.3</span></h2><p>Install a recommended font and apply font settings, with undo.</p></section>
  <section class="soon"><h2>Icons <span class="tag">coming in 1.4</span></h2><p>File icons in Capella's colours.</p></section>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  vscode.postMessage({ type: 'ready' });
</script>
</body></html>`;
  }
}

module.exports = { CapellaPanel };
