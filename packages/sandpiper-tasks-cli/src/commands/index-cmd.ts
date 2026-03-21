import { Command } from "@commander-js/extra-typings";
import { updateIndex } from "../core/index-update.js";
import { getRootDir, resolveTasksDir, withErrorHandling } from "./helpers.js";

export const indexCommand = new Command("index")
	.description("Manage the task index")
	.addCommand(
		new Command("update")
			.description("Scan task files and update the index")
			.action((_opts, cmd) => {
				withErrorHandling(() => {
					const tasksDir = resolveTasksDir(getRootDir(cmd));
					const index = updateIndex(tasksDir);

					const taskCount = Object.keys(index.tasks).length;
					const projectCount = new Set(
						Object.values(index.tasks).map((t) => t.project),
					).size;

					console.log(
						`Index updated: ${taskCount} task${taskCount !== 1 ? "s" : ""} across ${projectCount} project${projectCount !== 1 ? "s" : ""}`,
					);
				});
			}),
	);
