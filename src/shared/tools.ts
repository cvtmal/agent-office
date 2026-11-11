import { BROWSER_TOOL_PREFIXES, TOOL_KIND, type ActivityKind } from './constants.js';

/** The activity kind of a tool name (scope DATA-3). */
export function toolKind(tool: string): ActivityKind {
  if (Object.hasOwn(TOOL_KIND, tool)) {
    return TOOL_KIND[tool as keyof typeof TOOL_KIND];
  }
  if (BROWSER_TOOL_PREFIXES.some((prefix) => tool.startsWith(prefix))) {
    return 'web';
  }
  return 'other';
}
