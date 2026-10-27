import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = path.join(root, 'apps/server/dist/index.js');
const webDist = path.join(root, 'apps/web/dist/index.html');

if (!fs.existsSync(serverEntry)) {
  console.error('Server build not found. Run: npm run build');
  process.exit(1);
}

if (!fs.existsSync(webDist)) {
  console.error('Frontend build not found at apps/web/dist. Run: npm run build');
  process.exit(1);
}

console.log('Starting single-server Local MCP Toolkit (API + MCP + UI)...');

const child = spawn(process.execPath, [serverEntry], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'production',
    SERVE_WEB: process.env.SERVE_WEB || 'true',
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
