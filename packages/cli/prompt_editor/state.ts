import { createTwoFilesPatch, FILE_HEADERS_ONLY } from 'diff';
import type { DiagnosticPrompt } from './diagnostic.js';
import { type ProjectionPayload, projectionPayload, xmlTags } from './markup.js';
import {
  applySourceChanges,
  buildShadowProjection,
  buildSourceChanges,
  type PendingSourceChange,
  type PromptProjection,
  rollbackSourceChanges,
} from './projection.js';
import { buildEditorProjection, type PromptSourceCatalog } from './regions.js';

export class StaleProjectionError extends Error {
  override name = 'StaleProjectionError';
}

/** Header text for the page. The fields keep the names the page reads. */
export interface EditorIdentity {
  readonly key: string;
  readonly name: string;
  readonly job: string;
}

export interface StagePayload {
  readonly draftRevision: number;
  readonly pendingFileCount: number;
  readonly pendingRegionCount: number;
  readonly pendingRegionIds: readonly string[];
  readonly previewReady: boolean;
}

export interface EditorPayload extends ProjectionPayload, StagePayload {
  readonly identity: EditorIdentity;
}

export interface PreviewPayload extends StagePayload {
  readonly fileCount: number;
  readonly files: ReadonlyArray<{ readonly path: string; readonly diff: string }>;
}

export interface PromptEditorStateOptions {
  /** Renders the prompt again, from the files as they are now. */
  readonly render: () => Promise<DiagnosticPrompt>;
  readonly catalog: PromptSourceCatalog;
  readonly identity: EditorIdentity;
}

function sameEdits(left: ReadonlyMap<string, string>, right: ReadonlyMap<string, string>): boolean {
  return left.size === right.size && [...left].every(([id, text]) => right.get(id) === text);
}

function sourceDiff(change: PendingSourceChange): string {
  return createTwoFilesPatch(
    `${change.path} (current)`,
    `${change.path} (staged)`,
    change.previousSource,
    change.updatedSource,
    undefined,
    undefined,
    { headerOptions: FILE_HEADERS_ONLY },
  );
}

/**
 * The editor's view of one rendered prompt and the edits staged against it. Staging and previewing never write
 * files. Applying writes the previewed edits, renders again, and restores the files if that render fails.
 */
export class PromptEditorState {
  /** True while a page message is handled, so the source watcher ignores the editor's own writes. */
  busy = false;
  private currentGeneration = 1;
  private currentDraftRevision = 0;
  private staged = new Map<string, string>();
  private shadow: readonly PendingSourceChange[] = [];
  private previewRevision: number | undefined;
  private diagnostic: DiagnosticPrompt;
  private currentProjection: PromptProjection;
  private currentShadowProjection: PromptProjection;

  private constructor(
    private readonly options: PromptEditorStateOptions,
    diagnostic: DiagnosticPrompt,
  ) {
    this.diagnostic = diagnostic;
    this.currentProjection = buildEditorProjection(diagnostic, options.catalog);
    this.currentShadowProjection = this.currentProjection;
  }

  static async create(options: PromptEditorStateOptions): Promise<PromptEditorState> {
    return new PromptEditorState(options, await options.render());
  }

  get generation(): number {
    return this.currentGeneration;
  }

  get draftRevision(): number {
    return this.currentDraftRevision;
  }

  get projection(): PromptProjection {
    return this.currentProjection;
  }

  get shadowProjection(): PromptProjection {
    return this.currentShadowProjection;
  }

  get shadowSources(): readonly PendingSourceChange[] {
    return this.shadow;
  }

  get stagedEdits(): ReadonlyMap<string, string> {
    return this.staged;
  }

  async refresh(discardStaged = false): Promise<EditorPayload> {
    if (this.staged.size > 0 && !discardStaged) {
      throw new StaleProjectionError('Apply or close the editor before discarding pending edits');
    }
    const diagnostic = await this.options.render();
    const projection = buildEditorProjection(diagnostic, this.options.catalog);
    this.diagnostic = diagnostic;
    this.currentProjection = projection;
    this.currentShadowProjection = projection;
    this.staged = new Map();
    this.shadow = [];
    this.previewRevision = undefined;
    this.currentGeneration += 1;
    return this.renderPayload();
  }

  renderPayload(): EditorPayload {
    return {
      ...projectionPayload(this.currentShadowProjection, this.diagnostic.warnings, this.currentGeneration),
      ...this.stagePayload(),
      identity: this.options.identity,
    };
  }

  /** A file the current prompt shows as editable. Anything else is refused. */
  sourcePath(path: string): string {
    const region = this.currentProjection.regions.find((candidate) => candidate.path === path);
    if (!region) throw new StaleProjectionError(`Not an editable source of this prompt: ${path}`);
    return region.path;
  }

  private renderedRegions(): Map<string, string> {
    return new Map(
      this.currentProjection.segments.flatMap((segment) =>
        segment.region ? [[segment.region.id, segment.text] as const] : [],
      ),
    );
  }

  private stagePayload(): StagePayload {
    return {
      draftRevision: this.currentDraftRevision,
      pendingFileCount: this.shadow.length,
      pendingRegionCount: this.staged.size,
      pendingRegionIds: [...this.staged.keys()],
      previewReady: this.staged.size > 0 && this.previewRevision === this.currentDraftRevision,
    };
  }

  private validateLockedTags(original: string, staged: string): void {
    const originalTags = xmlTags(original);
    const stagedTags = xmlTags(staged);
    if (originalTags.length !== stagedTags.length || originalTags.some((tag, index) => tag !== stagedTags[index])) {
      throw new StaleProjectionError('XML tags are locked and cannot be changed');
    }
  }

  private updateStagedEdits(staged: Map<string, string>): StagePayload {
    if (!sameEdits(staged, this.staged)) {
      const shadow = buildSourceChanges(this.currentProjection, staged);
      this.staged = staged;
      this.shadow = shadow;
      this.currentDraftRevision += 1;
      this.previewRevision = undefined;
      this.currentShadowProjection = buildShadowProjection(this.currentProjection, staged);
    }
    return this.stagePayload();
  }

  stage(generation: number, regionId: string, renderedText: string): StagePayload {
    if (generation !== this.currentGeneration) {
      throw new StaleProjectionError('The prompt changed; refresh before editing');
    }
    const original = this.renderedRegions().get(regionId);
    if (original === undefined) throw new StaleProjectionError('The editable source region no longer exists');
    this.validateLockedTags(original, renderedText);

    const staged = new Map(this.staged);
    if (renderedText === original) staged.delete(regionId);
    else staged.set(regionId, renderedText);
    return this.updateStagedEdits(staged);
  }

  stageAll(generation: number, renderedRegions: ReadonlyMap<string, string>): StagePayload {
    if (generation !== this.currentGeneration) {
      throw new StaleProjectionError('The prompt changed; refresh before previewing');
    }
    const base = this.renderedRegions();
    if (renderedRegions.size !== base.size || [...renderedRegions.keys()].some((id) => !base.has(id))) {
      throw new StaleProjectionError('The editable source regions changed; refresh first');
    }
    for (const [id, text] of renderedRegions) this.validateLockedTags(base.get(id) ?? '', text);
    return this.updateStagedEdits(new Map([...renderedRegions].filter(([id, text]) => text !== base.get(id))));
  }

  preview(): PreviewPayload {
    this.shadow = buildSourceChanges(this.currentProjection, this.staged);
    this.previewRevision = this.currentDraftRevision;
    const files = this.shadow.map((change) => ({ path: change.path, diff: sourceDiff(change) }));
    return { ...this.stagePayload(), fileCount: files.length, files };
  }

  async apply(generation: number, draftRevision: number): Promise<EditorPayload> {
    if (generation !== this.currentGeneration) {
      throw new StaleProjectionError('The prompt changed; preview again before applying');
    }
    if (
      this.previewRevision === undefined ||
      draftRevision !== this.currentDraftRevision ||
      this.previewRevision !== this.currentDraftRevision
    ) {
      throw new StaleProjectionError('Preview the current edits before applying');
    }

    const applied = applySourceChanges(buildSourceChanges(this.currentProjection, this.staged));
    try {
      return await this.refresh(true);
    } catch (error) {
      rollbackSourceChanges(applied);
      throw error;
    }
  }
}
