/**
 * The short, privacy-safe target of a tool call (research D9, planning decision P1). A target comes from
 * one string field of the input and is never a prompt, content, pattern, query, description or result.
 * Pure: no file or process access.
 */
import { BROWSER_TOOL_PREFIXES } from '../../shared/constants.js';

const MAX_TARGET = 40;
/** P1: a shell word that may be shown. */
const SHELL_WORD = /^[A-Za-z0-9._+-]{1,40}$/;
/** P1: an identifier target (agent type, teammate, skill, workflow, browser action) that may be shown. */
const IDENTIFIER = /^[\w.:@/+-]{1,40}$/;
/** D9: a browser `action` that may be shown. */
const BROWSER_ACTION = /^[a-z_]{1,24}$/;
/** A leading `VAR=value` token of a shell command. */
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/**
 * Turns whitespace (incl. `\n`, `\t`) into one space so words do not merge, deletes other control
 * characters, collapses spaces, trims and cuts to 40 characters.
 */
export function clean(s: string): string {
  const flat = s.replace(/\s/g, ' ').replace(/\p{Cc}/gu, '').replace(/ +/g, ' ').trim();
  return Array.from(flat).slice(0, MAX_TARGET).join('');
}

/** The last non-empty segment after `/` or `\`. */
export function basename(p: string): string {
  return p.split(/[\\/]/).filter((segment) => segment !== '').pop() ?? '';
}

/** The host (with port, without user-info) of an `http:`/`https:` URL; else `''`. */
export function hostOf(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.host : '';
  } catch {
    return '';
  }
}

function field(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  return typeof value === 'string' ? value : '';
}

function identifier(value: string): string {
  return IDENTIFIER.test(value) ? clean(value) : '';
}

function shellWord(command: string): string {
  const words = command.trim().split(/\s+/);
  const first = words.find((word) => !ENV_ASSIGNMENT.test(word)) ?? '';
  const word = basename(first.replace(/^["']+|["']+$/g, ''));
  return SHELL_WORD.test(word) ? clean(word) : '';
}

function browserTarget(input: Record<string, unknown>): string {
  const host = hostOf(field(input, 'url'));
  if (host !== '') {
    return clean(host);
  }
  const action = field(input, 'action');
  return BROWSER_ACTION.test(action) ? identifier(action) : '';
}

/** The target shown for a call of `tool` with `input` (research D9). */
export function shapeTarget(tool: string, input: Record<string, unknown>): string {
  switch (tool) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return clean(basename(field(input, 'file_path')));
    case 'NotebookEdit':
      return clean(basename(field(input, 'notebook_path')));
    case 'LSP':
      return clean(basename(field(input, 'filePath') || field(input, 'file_path')));
    case 'Grep':
      return clean(basename(field(input, 'path')));
    case 'Glob':
      return clean(basename(field(input, 'pattern')));
    case 'Bash':
    case 'Monitor':
      return shellWord(field(input, 'command'));
    case 'WebFetch':
      return clean(hostOf(field(input, 'url')));
    case 'Agent':
      return identifier(field(input, 'subagent_type') || field(input, 'name'));
    case 'SendMessage':
      return identifier(field(input, 'to'));
    case 'Skill':
      return identifier(field(input, 'skill'));
    case 'Workflow':
      return identifier(field(input, 'name'));
    default:
      return BROWSER_TOOL_PREFIXES.some((prefix) => tool.startsWith(prefix)) ? browserTarget(input) : '';
  }
}
