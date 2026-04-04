---
name: skill-review
description: >-
  Review and audit skills for quality, triggering accuracy, structure, and adherence
  to best practices. Use when the user asks to review a skill, check if a skill is
  well-written, audit skill quality, or do a quality pass. Also use during self-
  reflection when you are editing or improving skills — before changing a skill's
  description, structure, or content, consult this skill for the review methodology.
  Triggers: "review skill", "audit skill", "skill quality", "skill isn't triggering",
  "improve this skill", or any session phase where skills are being modified.
---

# Skill Review

Review existing skills for quality, structure, and effectiveness. This skill provides a methodology for qualitative structural review — examining whether a skill is well-constructed as a document that will trigger reliably and guide the model effectively.

This is complementary to the skill-creator skill, which focuses on empirical testing (running evals, grading outputs, iterating). Use this skill when you want to assess and improve a skill's construction without running a full eval loop.

## Required Reference

This skill relies on `references/skill-building-guide.pdf` — Anthropic's complete guide to building skills. **Read this PDF before conducting a review.** It is the authoritative source for skill best practices, and the review dimensions below are derived from it.

The PDF is downloaded automatically by `bun install` (via the `postinstall` script). If it's missing, download it manually:

```bash
curl -L -o references/skill-building-guide.pdf \
  "https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf"
```

The PDF is gitignored — it is not committed to version control.

## Review Process

For each skill under review:

1. **Read the skill thoroughly** — SKILL.md, all reference files, scripts directory listing. Understand what the skill is trying to accomplish and who it's for.
2. **Assess each dimension** below, noting specific issues and proposed fixes.
3. **Prioritize by impact** — description quality has the highest impact on whether a skill gets used at all. Structure and tone affect how well it works once triggered.
4. **Make changes** — apply improvements, explaining the reasoning to the user.

## Review Dimensions

### 1. Description (highest impact)

The description field is the primary triggering mechanism — it determines whether the skill gets loaded at all. This is the single most impactful thing to get right.

**Check for trigger phrases.** The description should include the natural language a user would actually type when they need this skill. Not abstract capabilities, but concrete phrases and keywords. A user doesn't say "I need structural code analysis" — they say "find all places where we call processEvent" or "refactor this pattern across the codebase."

```
# Weak — describes the skill's content, not when to use it
description: Manages project tasks with YAML frontmatter.

# Strong — includes what real users would say
description: >-
  Create, update, and query project tasks. Use when the user asks to create a
  ticket, check what's left to do, mark something as done, see what's in progress,
  or manage a backlog.
```

**Check for undertriggering risk.** Today's models tend to undertrigger skills — they don't load them when they'd be useful. Descriptions should be slightly "pushy" — include adjacent keywords, synonyms, and paraphrases. If the skill handles version control, mention "commit", "push", "diff", "branch", "undo", etc. even if the user might phrase things differently.

**Check for overtriggering risk.** If the description is too broad, the skill loads for unrelated queries. Look for vague terms like "helps with projects" or "processes documents" that could match too many contexts. The best descriptions are specific about what the skill does AND when to use it.

**Check length.** Descriptions must be under 1024 characters. They should be dense with trigger-relevant information, not padded with filler.

### 2. Structure and Progressive Disclosure

Skills use a three-level loading system, and each level should earn its place:

- **Level 1 (frontmatter)** — always in context. Just name + description. Should be sufficient for the model to decide whether to load the skill.
- **Level 2 (SKILL.md body)** — loaded when the skill triggers. Should contain everything needed to use the skill effectively. Target under 500 lines.
- **Level 3 (references/, scripts/)** — loaded on demand. Detailed reference material, edge cases, full specifications.

**Check that the SKILL.md body isn't a reference manual.** The body should lead with workflows and guidance (how to use this), not exhaustive API docs (every possible option). Move detailed reference material to `references/`.

**Check that reference files are clearly linked.** When the body defers to a reference file, it should explain when and why to read it — not just mention it exists.

**Check that the most important content comes first.** The model may not read the entire skill carefully. Put workflow guidance, key patterns, and critical instructions near the top. Command references, advanced features, and edge cases go lower.

### 3. Tone and Instruction Style

**Check for heavy-handed directives.** Instructions that rely on "MUST", "ALWAYS", "NEVER", "IMPORTANT" in all-caps are a yellow flag. These are less effective than explaining the reasoning behind a rule. Models respond better to understanding *why* something matters than being ordered to do it.

```
# Heavy-handed — tells the model what to do but not why
IMPORTANT: Always use jj commands instead of git commands.

# Reasoning-based — the model understands and can generalize
Always use jj commands rather than git — even though the underlying repo is
Git-backed, jj's model avoids entire categories of mistakes (lost work, detached
HEAD, botched rebases) because every operation is automatically recorded and
undoable.
```

There are exceptions — sometimes a brief imperative is the right call for a critical constraint that doesn't need explanation (e.g., "Pattern code must be valid syntax that tree-sitter can parse"). But if you find yourself writing paragraphs of MUSTs, the skill is probably compensating for unclear reasoning.

**Check for generality vs. overfitting.** Instructions should explain principles, not enumerate every specific case. A skill that says "if the user says X, do Y; if they say Z, do W" is fragile. A skill that explains the underlying approach and gives representative examples is robust.

### 4. Workflow Examples

**Check for real-world scenarios.** A skill should include examples of what a user would actually ask and how the skill helps accomplish it. These serve double duty — they help the model understand the skill's purpose, and they demonstrate the expected interaction pattern.

Good examples are concrete and realistic, with enough context to show the full flow:

```markdown
### Starting a new feature

1. Create a task: `task create -p SHR -t "Implement feature X" --priority HIGH`
2. Pick it up: `task pickup SHR-1`
3. Create subtasks if needed: `task create -p SHR -t "Write parser" -k SUBTASK --parent SHR-1`
4. Work, committing with `Refs: SHR-1` in commit messages
```

**Check that examples cover common cases, not just happy paths.** What happens when something goes wrong? What are the edge cases? A troubleshooting section or "common mistakes" section helps the model handle real-world situations.

### 5. Troubleshooting and Error Handling

**Check for a troubleshooting or common mistakes section.** Skills that guide complex workflows should anticipate what goes wrong and explain how to recover. Missing this section means the model has to improvise when it hits an error — and it may improvise poorly.

Good troubleshooting entries explain the symptom, why it happens, and how to fix it:

```markdown
**Forgetting `-m` on squash**: Without `-m`, jj opens an editor.
In non-interactive contexts this hangs indefinitely. Always use
`jj squash -m "message"`.
```

### 6. Completeness

**Check for a `compatibility` field** if the skill has external dependencies (CLI tools, runtime requirements, MCP servers).

**Check that bundled scripts are referenced using relative paths** (e.g., `scripts/my-tool`) from the SKILL.md body, with guidance on when to use them. Code examples in fenced blocks must use `scripts/` paths, not bare command names — agents resolve these relative paths against the skill directory at runtime. A bare command name (e.g., `my-tool` instead of `scripts/my-tool`) will cause agents to try to find the command on `$PATH`, which fails.

**Check for missing file-type conventions.** If the skill uses `references/` or `scripts/`, verify the directory names are correct and the linking is clear.

## Presenting Findings

When presenting a review to the user, organize findings by skill with a brief summary of the overall assessment, then specific issues grouped by dimension. Lead with the highest-impact changes.

```markdown
## skill-name — [Overall assessment: needs significant work / moderate improvements / minor tweaks]

### Description
- [specific issue and proposed fix]

### Structure
- [specific issue and proposed fix]

### Tone
- [specific issue and proposed fix]
```

After presenting findings, offer to implement the changes. Apply improvements surgically — preserve what's working, fix what isn't.
