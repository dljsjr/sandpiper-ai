// Whether the model can call the `skill` tool. Sandpiper renders its skills section only when it can;
// otherwise Pi renders its own, naming a file reader the model has, or leaves the section out.

export const SKILL_TOOL_NAME = 'skill';
const TOOL_SEARCH_TOOL_NAME = 'tool_search';

/** How the model reaches the `skill` tool: declared to it, or loaded on demand with `tool_search`. */
export type SkillToolReachability = 'declared' | 'deferred';

export interface SkillToolReachabilityInput {
  /** The active tools (Pi's `selectedTools`). */
  readonly selectedTools?: readonly string[];
  /** Active tools whose declarations Pi leaves out of requests, such as tools behind codemode. */
  readonly hiddenTools?: readonly string[];
  /** The registered `skill` tool's exposure; undefined when it is not registered or not known. */
  readonly skillToolExposure?: string;
}

/** How the model reaches the `skill` tool, or undefined when it cannot call it. */
export function skillToolReachability(input: SkillToolReachabilityInput): SkillToolReachability | undefined {
  const declared = (name: string) =>
    (input.selectedTools ?? []).includes(name) && !(input.hiddenTools ?? []).includes(name);
  // Checked first so that loading a deferred skill tool does not change the prompt mid-session.
  if (input.skillToolExposure === 'deferred' && declared(TOOL_SEARCH_TOOL_NAME)) return 'deferred';
  if (declared(SKILL_TOOL_NAME)) return 'declared';
  return undefined;
}
