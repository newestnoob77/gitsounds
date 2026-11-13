// Detects git actions by tailing the repo's reflogs (.git/logs). Git appends one line per
// successful ref change, so this catches terminal commands and VS Code buttons alike.
const fs = require('fs');
const path = require('path');

const ACTIONS = ['commit', 'push', 'pull', 'fetch', 'merge', 'checkout', 'rebase', 'reset', 'stash', 'cherry-pick', 'revert'];

// rel: reflog path relative to .git/logs ('HEAD', 'refs/stash', 'refs/remotes/origin/main').
// line: one reflog entry "<old> <new> <who> <when>\t<message>". Returns an action or null.
function classify(rel, line) {
  const msg = line.slice(line.indexOf('\t') + 1);
  if (rel === 'refs/stash') return 'stash';
  if (rel.startsWith('refs/remotes/')) {
    if (msg.startsWith('update by push')) return 'push';
    if (msg.startsWith('fetch')) return 'fetch';
    return null; // a pull's fetch is also logged here; HEAD already reports it as 'pull'
  }
  if (rel !== 'HEAD') return null; // branch logs duplicate what HEAD says
  if (msg === 'reset: moving to HEAD') return null; // written by `git stash`, not a real reset
  if (/^checkout: moving from (\S+) to \1$/.test(msg)) return null;
  const head = msg.split(':')[0];
  const phase = (head.match(/\(([\w-]+)\)/) || [])[1];
  const word = head.split(' ')[0];
  if (word === 'commit') return phase === 'merge' ? 'merge' : phase === 'cherry-pick' ? 'cherry-pick' : 'commit';
  if (phase && phase !== 'finish') return null; // rebase/pull --rebase (start)/(pick) steps
  return ACTIONS.includes(word) ? word : null;
}

// Calls onAction(action) for every new reflog entry under gitDir. Returns a stop function.
function watchRepo(gitDir, onAction) {
  const logs = path.join(gitDir, 'logs');
  const offsets = new Map();
  const size = f => { try { return fs.statSync(f).size; } catch { return 0; } };
  const walk = d => {
    let out = [];
    try {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        out = out.concat(e.isDirectory() ? walk(p) : [p]);
      }
    } catch {}
    return out;
  };
  for (const f of walk(logs)) offsets.set(f, size(f)); // existing history stays silent

  const check = f => {
    const end = size(f);
    const start = offsets.has(f) ? offsets.get(f) : 0; // new file (e.g. first push of a branch): read it all
    if (end < start) offsets.set(f, end); // reflog was rewritten (stash pop, gc): nothing new
    if (end <= start) return;
    const buf = Buffer.alloc(end - start);
    const fd = fs.openSync(f, 'r');
    try { fs.readSync(fd, buf, 0, buf.length, start); } finally { fs.closeSync(fd); }
    const text = buf.toString('utf8');
    const done = text.lastIndexOf('\n') + 1; // leave a half-written line for the next event
    offsets.set(f, start + Buffer.byteLength(text.slice(0, done)));
    const rel = path.relative(logs, f).split(path.sep).join('/');
    for (const line of text.slice(0, done).split('\n')) {
      const action = line && classify(rel, line);
      if (action) onAction(action);
    }
  };

  // Watch .git rather than .git/logs: logs/ doesn't exist until the first commit.
  const watcher = fs.watch(gitDir, { recursive: true }, (_, name) => {
    if (name && name.startsWith('logs' + path.sep)) {
      try { check(path.join(gitDir, name)); } catch {} // file vanished mid-read (stash drop, gc)
    }
  });
  return () => watcher.close();
}

module.exports = { ACTIONS, classify, watchRepo };
