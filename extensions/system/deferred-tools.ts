// Deferred tools are registered but not declared to the model until `tool_search` loads them. Pi's
// tools section lists the ones not loaded yet (Sandpiper's local Pi patch renders the block from
// `systemPromptOptions.deferredTools`), and `tool_search` must be active to load them.
import type { ExtensionAPI, ExtensionContext, ToolInfo } from '@earendil-works/pi-coding-agent';

const TOOL_SEARCH_TOOL_NAME = 'tool_search';

/**
 * Names of the deferred tools the tools section lists, sorted so the prompt stays stable. MCP tools
 * have a namespace and are listed under `<mcp_servers>` instead.
 */
export function deferredToolNames(tools: readonly ToolInfo[]): string[] {
  return tools
    .filter((tool) => tool.exposure === 'deferred' && tool.namespace === undefined)
    .map((tool) => tool.name)
    .sort();
}

export function registerDeferredToolHooks(pi: ExtensionAPI): void {
  let warnedUnreachable = false;

  // Mirrors `ensureDiscoveryActive` in Pi's MCP extension: only a tool_search that declares
  // `reachesTools` can load deferred tools, and an unreachable loadout warns once per session.
  const ensureToolSearchActive = (ctx: ExtensionContext): void => {
    const tools = pi.getAllTools();
    const deferred = deferredToolNames(tools);
    if (deferred.length === 0) return;
    const active = pi.getActiveTools();
    if (active.includes(TOOL_SEARCH_TOOL_NAME)) return;
    if (tools.some((tool) => tool.name === TOOL_SEARCH_TOOL_NAME && tool.reachesTools)) {
      pi.setActiveTools([...active, TOOL_SEARCH_TOOL_NAME]);
      return;
    }
    const unreachable = deferred.filter((name) => !active.includes(name));
    if (unreachable.length === 0 || warnedUnreachable) return;
    warnedUnreachable = true;
    ctx.ui.notify(
      `Deferred tools (${unreachable.join(', ')}) are only reachable from the ${TOOL_SEARCH_TOOL_NAME} tool, but it is not available; they cannot be called.`,
      'warning',
    );
  };

  pi.on('session_start', (_event, ctx) => {
    warnedUnreachable = false;
    ensureToolSearchActive(ctx);
  });

  // A separate handler from the startup prompt hook, so the list is set under a user's custom
  // prompt too. Pi re-renders it against the active tools before every call of the run.
  pi.on('before_agent_start', (event, ctx) => {
    ensureToolSearchActive(ctx);
    event.systemPromptOptions.deferredTools = deferredToolNames(pi.getAllTools());
  });
}
