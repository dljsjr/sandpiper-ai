import { extractCommandOutput } from './extensions/shell-relay/src/snapshot-diff.ts';

const PROMPT = 'PROMPT>'; 

function wrap(s: string, width: number): string[] {
  const lines: string[] = [];
  for (let i = 0; i < s.length; i += width) lines.push(s.slice(i, i + width));
  return lines;
}

function randomCmd(i: number): string {
  const parts = [
    "echo 'alpha'",
    'echo "beta gamma"',
    "printf '%s\\n' 'it'\"'\"'s complicated'",
    "echo 'x y z'",
    "echo done",
  ];
  let cmd = '';
  const n = 2 + (i % 6);
  for (let j = 0; j < n; j++) {
    cmd += (j ? '; ' : '') + parts[(i + j * 3) % parts.length];
  }
  return cmd;
}

let failures = 0;
for (let width = 20; width <= 80; width++) {
  for (let i = 0; i < 1000; i++) {
    const escaped = randomCmd(i);
    const injected = `__relay_run '${escaped}'`;
    const wrapped = wrap(injected, width);
    const output = ['OUT1', 'OUT2'];
    const before = [PROMPT, ''].join('\n');
    const after = [PROMPT, ...wrapped, ...output, PROMPT, ''].join('\n');
    const result = extractCommandOutput(before, after, injected);
    if (result !== 'OUT1\nOUT2') {
      failures++;
      console.log('FAIL', { width, i, injected, result });
      if (failures > 20) process.exit(1);
    }
  }
}
console.log('done, failures', failures);
