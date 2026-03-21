import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "./frontmatter.js";

describe("parseFrontmatter", () => {
	it("should parse simple key-value pairs", () => {
		const content = `---
title: My Task
status: IN PROGRESS
kind: TASK
---

# My Task
`;
		const fm = parseFrontmatter(content);
		expect(fm.title).toBe("My Task");
		expect(fm.status).toBe("IN PROGRESS");
		expect(fm.kind).toBe("TASK");
	});

	it("should strip surrounding double quotes from values", () => {
		const content = `---
title: "Quoted title"
---
`;
		const fm = parseFrontmatter(content);
		expect(fm.title).toBe("Quoted title");
	});

	it("should parse arrays with dash syntax", () => {
		const content = `---
title: Task
depends_on:
  - SHR-1
  - SHR-2
  - SHR-3
---
`;
		const fm = parseFrontmatter(content);
		expect(fm.depends_on).toEqual(["SHR-1", "SHR-2", "SHR-3"]);
	});

	it("should handle multiple arrays", () => {
		const content = `---
title: Task
depends_on:
  - SHR-1
blocked_by:
  - SHR-4
related:
  - SHR-5
  - SHR-6
---
`;
		const fm = parseFrontmatter(content);
		expect(fm.depends_on).toEqual(["SHR-1"]);
		expect(fm.blocked_by).toEqual(["SHR-4"]);
		expect(fm.related).toEqual(["SHR-5", "SHR-6"]);
	});

	it("should return empty object for content without frontmatter", () => {
		const content = "# Just a heading\n\nSome text.\n";
		const fm = parseFrontmatter(content);
		expect(fm).toEqual({});
	});

	it("should handle all required task fields", () => {
		const content = `---
title: "Full task"
status: NEEDS REVIEW
kind: BUG
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-20T15:00:00Z
updated_at: 2026-03-21T10:00:00-05:00
---
`;
		const fm = parseFrontmatter(content);
		expect(fm.title).toBe("Full task");
		expect(fm.status).toBe("NEEDS REVIEW");
		expect(fm.kind).toBe("BUG");
		expect(fm.priority).toBe("HIGH");
		expect(fm.assignee).toBe("AGENT");
		expect(fm.reporter).toBe("USER");
		expect(fm.created_at).toBe("2026-03-20T15:00:00Z");
		expect(fm.updated_at).toBe("2026-03-21T10:00:00-05:00");
	});

	it("should handle empty arrays", () => {
		const content = `---
title: Task
depends_on:
status: NOT STARTED
---
`;
		const fm = parseFrontmatter(content);
		// An empty array key followed by another key should produce empty array
		expect(fm.depends_on).toEqual([]);
		expect(fm.status).toBe("NOT STARTED");
	});
});
