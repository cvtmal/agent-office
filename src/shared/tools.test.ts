import { describe, expect, it } from 'vitest';
import { toolKind } from './tools.js';

describe('toolKind', () => {
  it.each([
    ['Read', 'read'],
    ['Edit', 'write'],
    ['Bash', 'shell'],
    ['WebFetch', 'web'],
    ['Agent', 'delegate'],
    ['TodoWrite', 'plan'],
  ] as const)('maps %s to %s', (tool, kind) => {
    expect(toolKind(tool)).toBe(kind);
  });

  it('maps both browser prefixes to web', () => {
    expect(toolKind('mcp__claude-in-chrome__navigate')).toBe('web');
    expect(toolKind('mcp__playwright__browser_click')).toBe('web');
  });

  it('maps an unknown name to other', () => {
    expect(toolKind('mcp__github__create_issue')).toBe('other');
    expect(toolKind('toString')).toBe('other');
  });
});
