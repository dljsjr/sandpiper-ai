const ACTIVITY_LOG_MARKER = "\n---\n\n# Activity Log";

/**
 * Extract the description body from a task file's content.
 * The description is everything between the `# Title` heading and
 * the activity log delimiter (if present).
 */
export function extractDescription(content: string): string {
	const headingMatch = content.match(/^# .+$/m);
	if (!headingMatch) return "";

	const headingEnd = content.indexOf(headingMatch[0]) + headingMatch[0].length;
	let body = content.slice(headingEnd);

	// Stop at activity log if present
	const logIdx = body.indexOf(ACTIVITY_LOG_MARKER);
	if (logIdx !== -1) {
		body = body.slice(0, logIdx);
	}

	return body.replace(/^\n+/, "");
}

/**
 * Replace the description body in a task file's content.
 * Preserves frontmatter, the `# Title` heading, and the activity log (if present).
 */
export function replaceDescription(
	content: string,
	newDescription: string,
): string {
	const headingMatch = content.match(/^# .+$/m);
	if (!headingMatch) return content;

	const headingEnd = content.indexOf(headingMatch[0]) + headingMatch[0].length;
	const prefix = content.slice(0, headingEnd);

	// Preserve activity log if present
	const afterHeading = content.slice(headingEnd);
	const logIdx = afterHeading.indexOf(ACTIVITY_LOG_MARKER);
	const activityLog = logIdx !== -1 ? afterHeading.slice(logIdx) : "";

	const desc = newDescription.trim();
	if (desc === "") {
		return `${prefix}\n\n${activityLog}`;
	}
	return `${prefix}\n\n${desc}\n${activityLog}`;
}
