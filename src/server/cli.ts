// Command line entry: `bin/agent-office [--port N] [--dev] [--open] [--sample | --replay DIR [--speed N]]`.
// The default source is the live config dir (research R9); `--sample` serves the sample; `--replay`
// plays a replay set through the live source (R8, DATA-9).
// The config file (R10) is always loaded; its problems are printed and the defaults fill in.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_PORT } from '../shared/constants.js';
import { loadConfig } from './config/file.js';
import { parseLaneEnv, resolvePort } from './config/port.js';
import { readHarness } from './harness/read.js';
import { filterFor } from './live/filter.js';
import { createLiveSource, type LiveSource, type LiveSourceOptions, staticSource } from './live/source.js';
import { REPO_ROOT } from './paths.js';
import { ThresholdEnvError } from './reader/tokens.js';
import { ManifestError } from './replay/manifest.js';
import { startReplay, type Replay } from './replay/player.js';
import { loadSampleSnapshot } from './sample.js';
import { PortInUseError, startServer } from './start.js';

const USAGE = `Usage: agent-office [options]

  --port <n>       port to listen on (default: PORT, HARNESS_PORT, then ${String(DEFAULT_PORT)}; 0 picks a free one)
  --dev            serve the client through Vite with hot reload
  --open           open the office in the browser
  --sample         serve the sample snapshot instead of the live config dir
  --help           show this help

  --config <file>  config file (default: $XDG_CONFIG_HOME/agent-office/config.json, else ~/.config/...)
  --replay <dir>   play a replay set (e.g. fixtures/replay/harness) instead of the live config dir
  --speed <n>      replay speed, a number greater than 0 (needs --replay; default 1)
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
        sample: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
        config: { type: 'string' },
        replay: { type: 'string' },
        speed: { type: 'string' },
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
  if (values.speed !== undefined) {
    const speed = Number(values.speed);
    if (values.speed.trim() === '' || !Number.isFinite(speed) || speed <= 0) {
      fail(`--speed must be a number greater than 0, got "${values.speed}"`, 2);
    }
    if (values.replay === undefined) fail('--speed needs --replay', 2);
  }
  if (values.replay !== undefined && values.sample) fail('--replay and --sample cannot be combined', 2);

  const laneFile = join(REPO_ROOT, '.lane.env');
  const laneEnv = existsSync(laneFile) ? parseLaneEnv(readFileSync(laneFile, 'utf8')) : {};
  const resolved = resolvePort({ flag: values.port, env: process.env, laneEnv });
  if ('error' in resolved) fail(resolved.error, 2);

  const { config, problems } = loadConfig({ flag: values.config, env: process.env, home: homedir() });
  for (const problem of problems) process.stderr.write(`agent-office: config: ${problem}\n`);

  let replay: Replay | null = null;
  if (values.replay !== undefined) {
    try {
      replay = startReplay({ dir: resolve(values.replay), speed: values.speed === undefined ? 1 : Number(values.speed) });
    } catch (error) {
      if (error instanceof ManifestError) fail(`Invalid replay set: ${error.message}`, 2);
      throw error;
    }
  }

  const liveOptions: LiveSourceOptions =
    replay !== null
      ? {
          env: process.env,
          home: replay.manifest.home,
          config: { maxAgeHours: Infinity },
          cfgDir: replay.cfgDir,
          now: replay.now,
          liveness: replay.liveness,
          rootOf: replay.rootOf,
          dirOf: replay.dirOf,
          // The copy lies inside this repo: `git log` must not read this repo's history into the set.
          harness: { read: (dir) => readHarness(dir, { git: () => null }) },
        }
      : {
          env: process.env,
          home: homedir(),
          config: {
            ...(config.claudeConfigDir !== null ? { claudeConfigDir: config.claudeConfigDir } : {}),
            maxAgeHours: config.maxAgeHours,
            filter: filterFor(config),
          },
        };
  let source: LiveSource;
  try {
    source = values.sample ? staticSource(loadSampleSnapshot()) : await createLiveSource(liveOptions);
  } catch (error) {
    replay?.close();
    if (error instanceof ThresholdEnvError) fail(`Invalid environment: ${error.message}`, 2);
    throw error;
  }

  let server;
  try {
    server = await startServer({ port: resolved.port, dev: values.dev, source });
  } catch (error) {
    await source.close();
    replay?.close();
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
    replay?.close();
    void server.close().then(() => process.exit(0));
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
