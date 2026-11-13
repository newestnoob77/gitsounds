// Regenerates the built-in sounds in sounds/ (run: npm run sounds). Each step is [notes, ms];
// notes in a step play together as a chord.
const fs = require('fs');
const path = require('path');

const N = { G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988, C6: 1047, E6: 1319, G6: 1568 };
const TUNES = {
  commit: [[['C5'], 70], [['E5'], 70], [['G5'], 160]],
  push: [[['C5'], 60], [['G5'], 60], [['C6'], 60], [['G6'], 220]],
  pull: [[['G6'], 60], [['C6'], 60], [['G5'], 60], [['C5'], 220]],
  fetch: [[['A5'], 90]],
  merge: [[['E5'], 110], [['G5'], 110], [['C5', 'E5', 'G5', 'C6'], 380]],
  checkout: [[['D5'], 70], [['A5'], 140]],
  rebase: [[['B4'], 50], [['D5'], 50], [['F5'], 50], [['A5'], 50], [['B5'], 200]],
  reset: [[['G5'], 120], [['D5'], 120], [['G4'], 300]],
  stash: [[['E5'], 70], [['C5'], 160]],
  'cherry-pick': [[['E6'], 50], [['C6'], 50], [['E6'], 150]],
  revert: [[['G5'], 80], [['E5'], 80], [['C5'], 200]],
};

const RATE = 22050;
function wav(steps) {
  const samples = [];
  for (const [notes, ms] of steps) {
    const n = Math.round(RATE * ms / 1000);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const env = Math.min(1, i / 200) * Math.exp(-4 * t / (ms / 1000)); // click-free attack, plucky decay
      const v = notes.reduce((s, k) => s + Math.sin(2 * Math.PI * N[k] * t) + 0.3 * Math.sin(4 * Math.PI * N[k] * t), 0);
      samples.push(Math.round(0.35 * 32767 * env * v / notes.length / 1.3));
    }
  }
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(s, i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); // PCM, mono
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const out = path.join(__dirname, '..', 'sounds');
fs.mkdirSync(out, { recursive: true });
for (const [name, steps] of Object.entries(TUNES)) fs.writeFileSync(path.join(out, `${name}.wav`), wav(steps));
console.log(`wrote ${Object.keys(TUNES).length} sounds to ${out}`);
