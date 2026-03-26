import { Command } from '@commander-js/extra-typings';
import { createProject } from '../core/mutate.js';
import { writeProjectMetadata } from '../core/project-metadata.js';
import type { Task } from '../core/types.js';
import { getTasksDir, loadTasks, withErrorHandling } from './helpers.js';

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

const STATUS_ORDER = ['NOT STARTED', 'IN PROGRESS', 'NEEDS REVIEW', 'COMPLETE'];

const listCommand = new Command('list').description('List all projects with task counts').action((_opts, cmd) => {
  withErrorHandling(() => {
    const tasks = loadTasks(cmd);
    const projects = groupByProject(tasks);

    if (projects.size === 0) {
      console.log('No projects found.');
      return;
    }

    for (const [key, data] of [...projects.entries()].sort()) {
      const parts = STATUS_ORDER.filter((s) => data.byStatus[s]).map((s) => `${s}: ${data.byStatus[s]}`);

      console.log(`  ${key} (${data.total} task${data.total !== 1 ? 's' : ''}): ${parts.join(', ')}`);
    }
  });
});

const createCommand = new Command('create')
  .description('Create a new project with a PROJECT.md metadata file')
  .argument('<key>', 'Project key (uppercase letters, e.g., SHR, TOOLS)')
  .requiredOption('-n, --name <name>', 'Human-readable project name (e.g., "Shell Relay")')
  .requiredOption('-d, --description <description>', 'One-line description of the project')
  .requiredOption(
    '-w, --when-to-file <text>',
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

export const projectCommand = new Command('project')
  .description('Query and inspect projects')
  .addCommand(listCommand)
  .addCommand(createCommand);
