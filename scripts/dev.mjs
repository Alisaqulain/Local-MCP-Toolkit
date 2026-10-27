import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });
  return child;
}

console.log('Starting Local MCP Toolkit (server + web)...');
const server = run('server', 'npm', ['run', 'dev', '-w', '@local-mcp/server'], root);
const web = run('web', 'npm', ['run', 'dev', '-w', '@local-mcp/web'], root);

function shutdown() {
  server.kill('SIGTERM');
  web.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
