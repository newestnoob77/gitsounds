// Plays an audio file with the OS's own player, so the extension needs no dependencies.
const { spawn } = require('child_process');

function players(file) {
  if (process.platform === 'darwin') return [['afplay', file]];
  if (process.platform === 'win32') {
    const uri = file.replace(/'/g, "''");
    // MediaPlayer handles .wav and .mp3; wait for the clip's length so the process doesn't exit early.
    const ps = `Add-Type -AssemblyName PresentationCore; $p = New-Object System.Windows.Media.MediaPlayer; ` +
      `$p.Open([uri]'${uri}'); $p.Play(); $i = 0; while (-not $p.NaturalDuration.HasTimeSpan -and $i++ -lt 40) { Start-Sleep -m 50 }; ` +
      `if ($p.NaturalDuration.HasTimeSpan) { Start-Sleep -m ([int]$p.NaturalDuration.TimeSpan.TotalMilliseconds + 100) }`;
    return [['powershell', '-NoProfile', '-NonInteractive', '-Command', ps]];
  }
  return [['ffplay', '-nodisp', '-autoexit', '-loglevel', 'quiet', file], ['paplay', file], ['aplay', '-q', file]];
}

let current;
// Stops whatever is still playing, then plays file. onError gets a message if no player works.
function play(file, onError = () => {}) {
  if (current) current.kill();
  const tryNext = ([cmd, ...rest]) => {
    if (!cmd) return onError('No audio player found (Linux needs ffplay, paplay or aplay).');
    const child = spawn(cmd[0], cmd.slice(1), { stdio: 'ignore', windowsHide: true });
    child.on('error', () => tryNext(rest)); // player not installed: try the next one
    current = child;
  };
  tryNext(players(file));
}

module.exports = { play };
