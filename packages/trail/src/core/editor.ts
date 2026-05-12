import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Open content in $EDITOR, wait for the user to save and close,
 * then return the modified content.
 *
 * @param content - Initial content to edit
 * @param filename - Filename hint for the temp file (affects editor syntax highlighting)
 * @returns The edited content, or null if the user didn't change anything
 */
export function editInEditor(content: string, filename = 'task.md'): string | null {
  const editor = process.env.EDITOR ?? process.env.VISUAL ?? 'vi';

  const tmpDir = mkdtempSync(join(tmpdir(), 'sandpiper-edit-'));
  const tmpPath = join(tmpDir, filename);

  try {
    writeFileSync(tmpPath, content);

    execSync(`${editor} ${shellQuote(tmpPath)}`, {
      stdio: 'inherit',
    });

    const edited = readFileSync(tmpPath, 'utf-8');

    if (edited === content) {
      return null; // No changes
    }

    return edited;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
