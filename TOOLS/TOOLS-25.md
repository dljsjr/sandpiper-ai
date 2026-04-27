---
title: "Externalize Pi packages from bundled Sandpiper CLI"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-15T05:44:17.919Z
updated_at: 2026-07-11T16:53:29.595Z
---

# Externalize Pi packages from bundled Sandpiper CLI

Runtime imports from @earendil-works/pi-coding-agent inside user extensions fail when Sandpiper runs from the bundled JS CLI because Pi extension-loader aliases are computed relative to packages/cli/dist/standalone/sandpiper_standalone.js and resolve to packages/cli/index.js.

Fix by marking @earendil-works/* and @mariozechner/* packages external in Sandpiper Bun CLI bundles so Pi runtime code loads from node_modules rather than being inlined into the single-file bundle. Add regression coverage for extension runtime imports from pi-coding-agent.

---

# Activity Log

## 2026-05-15T06:13:00.331Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-07-11T16:53:29.595Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
