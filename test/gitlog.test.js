const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ACTIONS, classify, watchRepo } = require('../gitlog');

const line = msg => `aaa bbb t <t@t> 1700000000 +0000\t${msg}`;

test('classify maps real reflog messages to actions', () => {
  const cases = [
    ['HEAD', 'commit (initial): one', 'commit'],
    ['HEAD', 'commit (amend): fix', 'commit'],
    ['HEAD', 'commit (merge): Merge branch x', 'merge'],
    ['HEAD', 'commit (cherry-pick): p', 'cherry-pick'],
    ['HEAD', 'checkout: moving from main to feat', 'checkout'],
    ['HEAD', 'checkout: moving from main to main', null],
    ['HEAD', "merge feat: Merge made by the 'ort' strategy.", 'merge'],
    ['HEAD', 'pull --no-rebase -q: Fast-forward', 'pull'],
    ['HEAD', 'pull --rebase (finish): returning to refs/heads/main', 'pull'],
    ['HEAD', 'pull --rebase (pick): x', null],
    ['HEAD', 'rebase (start): checkout main', null],
    ['HEAD', 'rebase -i (finish): returning to refs/heads/rb', 'rebase'],
    ['HEAD', 'reset: moving to HEAD~1', 'reset'],
    ['HEAD', 'reset: moving to HEAD', null],
    ['HEAD', 'revert: Revert "three"', 'revert'],
    ['HEAD', 'cherry-pick: p', 'cherry-pick'],
    ['refs/heads/main', 'commit: two', null],
    ['refs/stash', 'WIP on main: 53ed7a7 p', 'stash'],
    ['refs/remotes/origin/main', 'update by push', 'push'],
    ['refs/remotes/origin/main', 'fetch -q: fast-forward', 'fetch'],
    ['refs/remotes/origin/main', 'pull --rebase -q: fast-forward', null],
  ];
  for (const [rel, msg, want] of cases) assert.strictEqual(classify(rel, line(msg)), want, msg);
});

test('package.json has a setting and a built-in sound for every action', () => {
  const props = require('../package.json').contributes.configuration.properties;
  for (const a of ACTIONS) {
    assert.ok(props[`gitsounds.${a}`], `setting for ${a}`);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'sounds', `${a}.wav`)), `sound for ${a}`);
  }
});

test('watchRepo hears real git commands', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitsounds-'));
  const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'ignore' });
  const work = path.join(dir, 'work');
  git(dir, 'init', '-q', '--bare', '-b', 'main', 'remote.git');
  git(dir, 'init', '-q', '-b', 'main', 'work');
  fs.writeFileSync(path.join(work, 'f'), 'old history\n');
  git(work, 'add', 'f');
  git(work, 'commit', '-qm', 'before watching'); // must stay silent

  const heard = [];
  const stop = watchRepo(path.join(work, '.git'), a => heard.push(a));
  const settle = () => new Promise(r => setTimeout(r, 300));
  const expect = async (want, run) => {
    heard.length = 0;
    run();
    for (let i = 0; i < 20 && !heard.includes(want); i++) await settle();
    await settle(); // catch any extra sounds
    assert.deepStrictEqual([...new Set(heard)], [want]);
  };
  try {
    await expect('commit', () => { fs.writeFileSync(path.join(work, 'f'), 'a\n'); git(work, 'commit', '-qam', 'a'); });
    await expect('checkout', () => git(work, 'switch', '-qc', 'feat'));
    await expect('commit', () => { fs.writeFileSync(path.join(work, 'g'), 'g\n'); git(work, 'add', 'g'); git(work, 'commit', '-qm', 'g'); });
    await expect('checkout', () => git(work, 'switch', '-q', 'main'));
    await expect('merge', () => git(work, 'merge', '-q', 'feat'));
    await expect('stash', () => { fs.writeFileSync(path.join(work, 'f'), 'dirty\n'); git(work, 'stash', '-q'); });
    git(work, 'remote', 'add', 'origin', '../remote.git');
    await expect('push', () => git(work, 'push', '-q', 'origin', 'main'));
    await expect('reset', () => git(work, 'reset', '-q', '--hard', 'HEAD~1'));
  } finally {
    stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
