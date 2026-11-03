// Starts the API server (restarts on change) and the Vite dev server together.
// Open http://localhost:5173 — Vite forwards /api calls to the server on :4747.

import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [
  spawn(npm, ['run', 'dev', '-w', 'server'], { stdio: 'inherit', shell: process.platform === 'win32' }),
  spawn(npm, ['run', 'dev', '-w', 'web'], { stdio: 'inherit', shell: process.platform === 'win32' }),
];

function stop() {
  for (const child of children) child.kill();
  process.exit();
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', (code) => code && stop());
