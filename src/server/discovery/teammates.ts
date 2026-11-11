// Running teammate processes from the process table (research D3).
import type { ProcessRow } from './processes.js';
import type { TeammateProc } from './types.js';

/** The value of `--flag X` or `--flag=X` in a whitespace-split argv, else null. */
function flagValue(argv: string[], flag: string): string | null {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (arg === flag) {
      const next = argv[i + 1];
      return next && !next.startsWith('--') ? next : null;
    }
    if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1) || null;
  }
  return null;
}

/** Processes whose command carries both `--agent-name X` and `--team-name Y`, deduplicated. */
export function teammateProcs(table: Map<number, ProcessRow>): TeammateProc[] {
  const seen = new Set<string>();
  const procs: TeammateProc[] = [];
  for (const row of table.values()) {
    const argv = row.command.trim().split(/\s+/);
    const agentName = flagValue(argv, '--agent-name');
    const teamName = flagValue(argv, '--team-name');
    if (agentName === null || teamName === null) continue;
    const key = `${agentName}\u0000${teamName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    procs.push({ agentName, teamName });
  }
  return procs;
}
