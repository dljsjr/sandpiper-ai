import { Command } from 'commander';
import { applyBoardAdoption, planBoardAdoption } from './trailBoardAdoption.js';

const program = new Command()
  .name('adopt-trail-board')
  .description('Adopt one existing Sandpiper task board in place with Trail v2 configuration.')
  .option('--dir <path>', 'Project root.', process.cwd())
  .requiredOption('--tasks-dir <path>', 'Existing task directory, relative to the project root or absolute.')
  .option('--config-file <path>', 'Explicit legacy configuration source instead of discovery.')
  .option('--dry-run', 'Report the plan without changing files.');

try {
  program.parse();
  const options = program.opts<{ dir: string; tasksDir: string; configFile?: string; dryRun?: boolean }>();
  const plan = planBoardAdoption({ rootDir: options.dir, tasksDir: options.tasksDir, configFile: options.configFile });
  if (!options.dryRun) applyBoardAdoption(plan);
  console.log(
    JSON.stringify(
      {
        result: options.dryRun ? 'dry-run' : plan.disposition === 'create' ? 'created' : 'already-adopted',
        action: plan.disposition,
        source: plan.legacySource ?? 'legacy defaults',
        task_directory: plan.tasksPath,
        configuration_file: plan.existingConfigPaths[0] ?? plan.configPath,
        existing_configurations: plan.existingConfigPaths,
        configuration: plan.config,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
