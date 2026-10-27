import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logging/logger.js';

/**
 * Vercel serverless has an ephemeral writable `/tmp` only.
 * Seed a tiny demo workspace so filesystem tools have something to show.
 */
export function seedVercelWorkspace(workspaceRoot: string): void {
  try {
    fs.mkdirSync(workspaceRoot, { recursive: true });
    const readme = path.join(workspaceRoot, 'README.md');
    if (!fs.existsSync(readme)) {
      fs.writeFileSync(
        readme,
        [
          '# Vercel ephemeral workspace',
          '',
          'This deployment runs on Vercel serverless.',
          'Files here live under `/tmp` and **are wiped between cold starts**.',
          'They are **not** your local PC files.',
          '',
        ].join('\n'),
        'utf8',
      );
    }
    const sample = path.join(workspaceRoot, 'examples');
    fs.mkdirSync(sample, { recursive: true });
    const hello = path.join(sample, 'hello.json');
    if (!fs.existsSync(hello)) {
      fs.writeFileSync(hello, JSON.stringify({ message: 'Hello from Vercel /tmp', ephemeral: true }, null, 2));
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to seed Vercel workspace');
  }
}
