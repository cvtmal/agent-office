// Command line entry: `bin/agent-office [--port N] [--dev] [--open]`.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_PORT } from '../shared/constants.js';
import { parseLaneEnv, resolvePort } from './config/port.js';
import { REPO_ROOT } from './paths.js';
import { PortInUseError, startServer } from './start.js';

const USAGE = `Usage: agent-office [options]

  --port <n>   port to listen on (default: PORT, HARNESS_PORT, then ${String(DEFAULT_PORT)})
  --dev        serve the client through Vite with hot reload
  --open       open the office in the browser
  --help       show this help

  --config <file>  arrives in cycle #3
  --replay <dir>   arrives in cycle #3
`;

function fail(message: string, code: number): never {
  process.stderr.write(message + '\n');
  process.exit(code);
}

async function main(): Promise<void> {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        port: { type: 'string' },
        dev: { type: 'boolean', default: false },
        open: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
        config: { type: 'string' },
        replay: { type: 'string' },
      },
      strict: true,
    }));
  } catch (error) {
    fail(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`, 2);
  }

  if (values.help) {
    process.stdout.write(USAGE);
    process.exit(0);
  }
  if (values.config !== undefined) fail('--config arrives in cycle #3', 2);
  if (values.replay !== undefined) fail('--replay arrives in cycle #3', 2);

  const laneFile = join(REPO_ROOT, '.lane.env');
  const laneEnv = existsSync(laneFile) ? parseLaneEnv(readFileSync(laneFile, 'utf8')) : {};
  const resolved = resolvePort({ flag: values.port, env: process.env, laneEnv });
  if ('error' in resolved) fail(resolved.error, 2);

  let server;
  try {
    server = await startServer({ port: resolved.port, dev: values.dev });
  } catch (error) {
    if (error instanceof PortInUseError) {
      fail(`Port ${String(error.port)} is in use. Stop it with "make stop" or pass --port.`, 1);
    }
    throw error;
  }

  const url = `http://127.0.0.1:${String(server.port)}/`;
  console.log(`Agent Office: ${url}`);
  if (values.open) {
    spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  }

  const stop = (): void => {
    void server.close().then(() => process.exit(0));
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
