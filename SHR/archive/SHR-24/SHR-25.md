---
title: "Create extension scaffolding"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T04:32:36.604Z
---

# Create extension scaffolding

Set up the extension directory structure at `extensions/shell-relay/`:

```
extensions/shell-relay/
├── index.ts
├── relay.ts
├── fifo.ts
├── zellij.ts
├── shell-integration/
│   ├── relay.fish
│   ├── relay.bash
│   └── relay.zsh
├── unbuffer-relay
├── package.json
└── tsconfig.json
```

Configure `package.json` with pi peer dependencies, `tsconfig.json` with `strict: true`.

**Reference:** AGENTS.md (Architecture section)

---

# Activity Log

## 2026-03-23T04:32:36.604Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
