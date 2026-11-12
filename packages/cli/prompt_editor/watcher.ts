import { statSync } from 'node:fs';
import { contentRevision, type PromptProjection, readSource } from './projection.js';

export interface WatchedEditor {
  readonly busy: boolean;
  readonly projection: PromptProjection;
}

/** Reports editable sources whose content changed on disk since the last render. */
export class SourceWatcher {
  private readonly signatures = new Map<string, string>();
  private readonly reported = new Map<string, string>();

  constructor(private readonly editor: WatchedEditor) {}

  /** Paths changed since the last check, each reported once per new content. Nothing while the editor is busy. */
  check(): string[] {
    if (this.editor.busy) return [];
    const changed: string[] = [];
    const revisions = new Map(this.editor.projection.regions.map((region) => [region.path, region.sourceRevision]));
    for (const [path, rendered] of revisions) {
      let current: string;
      try {
        const stat = statSync(path, { bigint: true });
        const signature = `${stat.mtimeNs}:${stat.size}`;
        if (this.signatures.get(path) === signature) continue;
        this.signatures.set(path, signature);
        current = contentRevision(readSource(path));
      } catch {
        continue;
      }
      if (current === rendered) {
        this.reported.delete(path);
      } else if (this.reported.get(path) !== current) {
        this.reported.set(path, current);
        changed.push(path);
      }
    }
    return changed;
  }

  /** Checks every `intervalMs` and passes changed paths to `notify`. Returns a function that stops watching. */
  watch(notify: (paths: string[]) => void, intervalMs: number): () => void {
    const timer = setInterval(() => {
      const changed = this.check();
      if (changed.length > 0) notify(changed);
    }, intervalMs);
    return () => clearInterval(timer);
  }
}
