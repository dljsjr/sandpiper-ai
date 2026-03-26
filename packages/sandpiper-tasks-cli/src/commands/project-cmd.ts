import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import { editInEditor } from '../core/editor.js';
import { writeFileAtomic } from '../core/fs.js';
import { createProject } from '../core/mutate.js';
import { formatProjectsOutput } from '../core/output.js';
import { PROJECT_METADATA_FILENAME } from '../core/patterns.js';
import { applyProjectMetadataUpdates, readProjectMetadata, writeProjectMetadata } from '../core/project-metadata.js';
import type { ProjectListItem, ProjectStatus, Task } from '../core/types.js';
import { getOutputFormat, getTasksDir, loadTasks, withErrorHandling } from './helpers.js';

interface ProjectStats {
  readonly total: number;
  readonly byStatus: Record<string, number>;
}

function groupByProject(tasks: readonly Task[]): Map<string, ProjectStats> {
  const projects = new Map<string, ProjectStats>();
  for (const task of tasks) {
    const existing = projects.get(task.project);
    const byStatus = { ...(existing?.byStatus ?? {}) };
    byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
    projects.set(task.project, {
      total: (existing?.total ?? 0) + 1,
      byStatus,
    });
  }
  return projects;
}

function buildProjectListItems(tasksDir: string, projects: Map<string, ProjectStats>): ProjectListItem[] {
  return [...projects.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => {
      const meta = readProjectMetadata(tasksDir, key);
      return {
        key,
        name: meta?.name ?? '',
        description: meta?.description ?? '',
        whenToFile: meta?.whenToFile ?? '',
        status: meta?.status ?? null,
        taskCount: data.total,
        byStatus: data.byStatus,
      };
    });
}

const STATUS_ORDER = ['NOT STARTED', 'IN PROGRESS', 'NEEDS REVIEW', 'COMPLETE'];

const listCommand = new Command('list')
  .description('List all projects with task counts and metadata')
  .action((_opts, cmd) => {
    withErrorHandling(() => {
      const tasksDir = getTasksDir(cmd);
      const tasks = loadTasks(cmd);
      const projects = groupByProject(tasks);

      if (projects.size === 0) {
        console.log('No projects found.');
        return;
      }

      const fmt = getOutputFormat(cmd);
      const items = buildProjectListItems(tasksDir, projects);

      if (fmt === 'json' || fmt === 'toon') {
        console.log(formatProjectsOutput(items, fmt));
        return;
      }

      for (const item of items) {
        const statusParts = STATUS_ORDER.filter((s) => item.byStatus[s]).map((s) => `${s}: ${item.byStatus[s]}`);
        const namePart = item.name ? ` — ${item.name}` : '';
        console.log(
          `  ${item.key}${namePart} (${item.taskCount} task${item.taskCount !== 1 ? 's' : ''}): ${statusParts.join(', ')}`,
        );
        if (item.description) {
          console.log(`    ${item.description}`);
        }
      }
    });
  });

const createCommand = new Command('create')
  .description('Create a new project with a PROJECT.md metadata file')
  .argument('<key>', 'Project key (uppercase letters, e.g., SHR, TOOLS)')
  .requiredOption('--name <name>', 'Human-readable project name (e.g., "Shell Relay")')
  .requiredOption('--description <description>', 'One-line description of the project')
  .requiredOption(
    '--when-to-file <text>',
    'One-line description of when to file a ticket here (used by the agent for routing)',
  )
  .action((key, opts, cmd) => {
    withErrorHandling(() => {
      const tasksDir = getTasksDir(cmd);
      const projectKey = key.toUpperCase();

      createProject(tasksDir, projectKey);
      writeProjectMetadata(tasksDir, {
        key: projectKey,
        name: opts.name,
        description: opts.description,
        whenToFile: opts.whenToFile,
      });

      console.log(`Created project: ${projectKey}`);
      console.log(`  Name:         ${opts.name}`);
      console.log(`  Description:  ${opts.description}`);
      console.log(`  When to file: ${opts.whenToFile}`);
      console.log(`  Metadata:     ${tasksDir}/${projectKey}/PROJECT.md`);
    });
  });

const showCommand = new Command('show')
  .description('Show PROJECT.md metadata for a project')
  .argument('<key>', 'Project key (e.g., SHR)')
  .action((key, _opts, cmd) => {
    withErrorHandling(() => {
      const tasksDir = getTasksDir(cmd);
      const projectKey = key.toUpperCase();
      const metaPath = join(tasksDir, projectKey, PROJECT_METADATA_FILENAME);

      if (!existsSync(metaPath)) {
        throw new Error(
          `No PROJECT.md found for project "${projectKey}". ` + `Run 'project create ${projectKey}' to initialize it.`,
        );
      }

      console.log(readFileSync(metaPath, 'utf-8'));
    });
  });

const updateCommand = new Command('update')
  .description('Update PROJECT.md metadata for a project')
  .argument('<key>', 'Project key (e.g., SHR)')
  .option('--name <name>', 'Set human-readable project name')
  .option('--description <description>', 'Set one-line project description')
  .option('--when-to-file <text>', 'Set when-to-file routing hint')
  .option('--status <status>', 'Set project status: active, archived, paused')
  .option('-i, --interactive', 'Open PROJECT.md in $EDITOR for editing')
  .action((key, opts, cmd) => {
    withErrorHandling(() => {
      const tasksDir = getTasksDir(cmd);
      const projectKey = key.toUpperCase();
      const metaPath = join(tasksDir, projectKey, PROJECT_METADATA_FILENAME);

      if (!existsSync(metaPath)) {
        throw new Error(
          `No PROJECT.md found for project "${projectKey}". ` + `Run 'project create ${projectKey}' to initialize it.`,
        );
      }

      if (opts.interactive) {
        let content = readFileSync(metaPath, 'utf-8');
        const fields = buildUpdateFields(opts);
        if (Object.keys(fields).length > 0) {
          content = applyProjectMetadataUpdates(content, fields);
        }

        const edited = editInEditor(content, 'PROJECT.md');
        if (edited === null) {
          console.log('No changes made.');
          return;
        }
        writeFileAtomic(metaPath, edited);
        console.log(`Updated ${projectKey}/PROJECT.md via editor.`);
        return;
      }

      const fields = buildUpdateFields(opts);
      if (Object.keys(fields).length === 0) {
        throw new Error(
          'No fields to update. Use --name, --description, --when-to-file, --status, or -i to edit in $EDITOR.',
        );
      }

      const content = readFileSync(metaPath, 'utf-8');
      writeFileAtomic(metaPath, applyProjectMetadataUpdates(content, fields));
      console.log(`Updated ${projectKey}/PROJECT.md.`);
    });
  });

function buildUpdateFields(opts: {
  name?: string;
  description?: string;
  whenToFile?: string;
  status?: string;
}): Parameters<typeof applyProjectMetadataUpdates>[1] {
  const fields: Record<string, string> = {};
  if (opts.name !== undefined) fields.name = opts.name;
  if (opts.description !== undefined) fields.description = opts.description;
  if (opts.whenToFile !== undefined) fields.whenToFile = opts.whenToFile;
  if (opts.status !== undefined) {
    const valid = ['active', 'archived', 'paused'];
    if (!valid.includes(opts.status)) {
      throw new Error(`Invalid status: "${opts.status}". Valid values: ${valid.join(', ')}`);
    }
    fields.status = opts.status as ProjectStatus;
  }
  return fields;
}

export const projectCommand = new Command('project')
  .description('Query and inspect projects')
  .addCommand(listCommand)
  .addCommand(createCommand)
  .addCommand(showCommand)
  .addCommand(updateCommand);
