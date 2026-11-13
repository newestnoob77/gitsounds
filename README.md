# Git Sounds

Hear a sound every time a git action succeeds: commit, push, pull, merge, and more. Use the built-in sounds or pick your own.

It runs quietly in the background whenever VS Code is open. You don't have to open any panel. It works for git commands typed in the terminal and for buttons clicked in the Source Control sidebar.

## Actions

`commit`, `push`, `pull`, `fetch`, `merge`, `checkout` (switching branches), `rebase`, `reset`, `stash`, `cherry-pick`, `revert`

A sound only plays when the action actually changes something. A failed push or a push with nothing to send stays silent. `fetch` is off by default, because VS Code auto-fetches every few minutes. Turn it on if you want a sound when teammates push new work.

## Choosing sounds

- **Command Palette** → `Git Sounds: Set Sound for a Git Action`: pick an action, then choose a `.wav`/`.mp3` file, the built-in sound, or no sound. Your choice plays once so you can hear it.
- **Settings** → search "Git Sounds": each action takes `default`, `off`, or the full path to a sound file.
- `Git Sounds: Mute / Unmute` turns everything off or back on.

## How it works

Git writes a line to `.git/logs/` (the reflog) after every successful ref change. The extension watches those files in each open workspace folder and maps each new line to an action ([gitlog.js](gitlog.js)). Sounds play through the operating system's own player ([play.js](play.js)): `afplay` on macOS, PowerShell's MediaPlayer on Windows, and `ffplay`, `paplay` or `aplay` on Linux (mp3 on Linux needs `ffplay`).

## Limits (MVP)

- Only repos at the root of a workspace folder. Worktrees, submodules and nested repos are not watched yet.
- VS Code must be open. Git commands run while it's closed make no sound.
- Events on GitHub itself (a PR merged on the website) are heard only when they reach you through a pull or fetch.

## Develop

```sh
npm test          # reflog parsing + a live git repo test
npm run sounds    # regenerate the built-in sounds in sounds/
npm run package   # build gitsounds-<version>.vsix
```

Install the build: `code --install-extension gitsounds-0.1.0.vsix`. Or press F5 in this folder to try it in a development window.
