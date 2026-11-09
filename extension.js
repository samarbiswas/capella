// Capella: the theme plus a sidebar panel with features.
// To add a feature: create features/<name>.js exporting { id, title, state(), actions }, add it to FEATURES below,
// and add its section to panel/panel.js. The colour theme itself never depends on this code.
'use strict';
const vscode = require('vscode');
const { CapellaPanel } = require('./panel/panel');

// Fixed list (no dynamic loading), so only reviewed code can run.
const FEATURES = [require('./features/theme-black')];

function activate(context) {
  const panel = new CapellaPanel(context, FEATURES);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('capella.panel', panel),
    vscode.commands.registerCommand('capella.openPanel', () =>
      vscode.commands.executeCommand('workbench.view.extension.capella')),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('workbench.colorCustomizations') || e.affectsConfiguration('workbench.colorTheme')) {
        panel.sendState();
      }
    }),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
