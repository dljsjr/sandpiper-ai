import { joinRendered, type RenderedText } from '../../packages/core/src/prompt-template.js';

export const SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL = 'sandpiper:prompt-contribution';

export type SandpiperPromptContributionPhase = 'prepend' | 'append';

export interface SandpiperPromptContribution {
  readonly id: string;
  readonly phase?: SandpiperPromptContributionPhase;
  readonly acknowledge?: () => void;
  readonly getContent: () => string | Promise<string | undefined> | undefined;
}

export interface ResolvedPromptContributions {
  readonly prepend: readonly string[];
  readonly append: readonly string[];
}

export function isSandpiperPromptContribution(value: unknown): value is SandpiperPromptContribution {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const contribution = value as Partial<SandpiperPromptContribution>;
  return (
    typeof contribution.id === 'string' &&
    contribution.id.trim().length > 0 &&
    (contribution.phase === undefined || contribution.phase === 'prepend' || contribution.phase === 'append') &&
    (contribution.acknowledge === undefined || typeof contribution.acknowledge === 'function') &&
    typeof contribution.getContent === 'function'
  );
}

export function applyPromptContributions(
  basePrompt: RenderedText,
  contributions: ResolvedPromptContributions,
): RenderedText {
  const sections = [...contributions.prepend, basePrompt, ...contributions.append].filter(
    (section) => (typeof section === 'string' ? section : section.text).length > 0,
  );
  return joinRendered(sections, '\n\n');
}

export class SandpiperPromptContributionCollector {
  readonly #contributions = new Map<string, SandpiperPromptContribution>();
  #resolved: ResolvedPromptContributions | undefined;

  add(value: unknown): void {
    if (this.#resolved !== undefined || !isSandpiperPromptContribution(value)) {
      return;
    }

    const id = value.id.trim();
    if (!this.#contributions.has(id)) {
      this.#contributions.set(id, { ...value, id });
      value.acknowledge?.();
    }
  }

  reset(): void {
    this.#contributions.clear();
    this.#resolved = undefined;
  }

  async resolve(): Promise<ResolvedPromptContributions> {
    if (this.#resolved !== undefined) {
      return this.#resolved;
    }

    const prepend: string[] = [];
    const append: string[] = [];

    for (const contribution of this.#contributions.values()) {
      let content: string | undefined;
      try {
        content = await contribution.getContent();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Sandpiper prompt contribution "${contribution.id}" failed: ${message}`);
        continue;
      }

      if (content === undefined || content.length === 0) {
        continue;
      }

      if (contribution.phase === 'prepend') {
        prepend.push(content);
      } else {
        append.push(content);
      }
    }

    this.#resolved = { prepend, append };
    return this.#resolved;
  }
}
