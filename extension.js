const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { ACTIONS, watchRepo } = require('./gitlog');
const { play } = require('./play');

const config = () => vscode.workspace.getConfiguration('gitsounds');

// The file to play for an action, or null when the user turned it off.
function soundFor(ctx, action) {
  const value = config().get(action) || 'default';
  if (value === 'off') return null;
  return value === 'default' ? path.join(ctx.extensionPath, 'sounds', `${action}.wav`) : value;
}

function playAction(ctx, action) {
  const file = soundFor(ctx, action);
  if (!file) return;
  if (!fs.existsSync(file)) return vscode.window.showWarningMessage(`Git Sounds: can't find "${file}" for ${action}.`);
  play(file, msg => vscode.window.showWarningMessage(`Git Sounds: ${msg}`));
}

async function setSound(ctx) {
  const action = await vscode.window.showQuickPick(ACTIONS, { placeHolder: 'Which git action?' });
  if (!action) return;
  const pick = await vscode.window.showQuickPick(
    ['Choose a sound file…', 'Use the built-in sound', 'No sound', 'Preview current sound'],
    { placeHolder: `Sound for ${action} (now: ${config().get(action)})` });
  if (pick === 'Preview current sound') return playAction(ctx, action);
  let value;
  if (pick === 'Use the built-in sound') value = 'default';
  if (pick === 'No sound') value = 'off';
  if (pick === 'Choose a sound file…') {
    const uris = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Audio: ['wav', 'mp3', 'm4a', 'aiff', 'ogg'] } });
    if (!uris) return;
    value = uris[0].fsPath;
  }
  if (!value) return;
  await config().update(action, value, vscode.ConfigurationTarget.Global);
  playAction(ctx, action);
}

function activate(ctx) {
  const lastPlayed = {};
  const onAction = action => {
    if (!config().get('enabled')) return;
    const now = Date.now();
    if (now - (lastPlayed[action] || 0) < 1500) return; // pushing 3 branches = one sound, not three
    lastPlayed[action] = now;
    playAction(ctx, action);
  };

  let stops = [];
  const start = () => {
    stops.forEach(stop => stop());
    // shortcut: only repos at a workspace folder's root with a real .git dir; worktrees, submodules
    // and nested repos are skipped. Upgrade by asking the built-in vscode.git API for repositories.
    stops = (vscode.workspace.workspaceFolders || [])
      .map(f => path.join(f.uri.fsPath, '.git'))
      .filter(d => fs.statSync(d, { throwIfNoEntry: false })?.isDirectory())
      .map(d => watchRepo(d, onAction));
  };
  start();

  ctx.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(start),
    { dispose: () => stops.forEach(stop => stop()) },
    vscode.commands.registerCommand('gitsounds.setSound', () => setSound(ctx)),
    vscode.commands.registerCommand('gitsounds.toggle', async () => {
      const on = !config().get('enabled');
      await config().update('enabled', on, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Git Sounds ${on ? 'on' : 'muted'}.`);
    }),
  );
}

module.exports = { activate, deactivate() {} };
