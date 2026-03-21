import { Command } from "@commander-js/extra-typings";
import { indexCommand } from "./commands/index-cmd.js";
import { projectCommand } from "./commands/project-cmd.js";
import { taskCommand } from "./commands/task-cmd.js";

const program = new Command()
	.name("sandpiper-tasks")
	.description("Markdown-based task management with YAML frontmatter")
	.version("0.0.1")
	.option(
		"-d, --dir <path>",
		"Path to the directory containing .sandpiper/tasks (defaults to cwd)",
	)
	.option("-f, --format <format>", "Output format: raw, json, toon")
	.option(
		"--no-save",
		"Skip writing to disk and index; output only (implies --format raw if no format set)",
	);

program.addCommand(indexCommand);
program.addCommand(taskCommand);
program.addCommand(projectCommand);

program.parse();
