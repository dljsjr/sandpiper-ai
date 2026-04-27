---
title: "Add ability to probe fetched domains for an `llms.txt`"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-13T05:18:48.985Z
updated_at: 2026-05-14T03:17:50.117Z
---

# Add ability to probe fetched domains for an `llms.txt`

A somewhat new convention many sites are adopting is including an `llms.txt` in their site root, much like `robots.txt`, to provide LLM-friendly routing guidance or site mapping.

Implement passive `llms.txt` existence probing in `web_fetch`.

Design notes:
- The probe is supplemental metadata only. It must never fail the main fetch.
- Probe cache keys should follow HTTP caching semantics. Include port; include scheme if that is the correct cache-key convention for HTTP caches.
- Probe `/<root>/llms.txt` for the fetched site's origin.
- Prefer `HEAD /llms.txt` for the existence check.
- If `HEAD` is not allowed (for example 405), do not blindly download the file with GET. Prefer returning an indeterminate/unknown probe result, optionally using the `Allow` header for metadata.
- Cache only existence/probe outcome and timestamp, not `llms.txt` content.
- Disk persistence is optional for now; in-memory or appendEntry/session-level storage is sufficient.

Returned payload should include an `llmsTxt`-style metadata object that can distinguish at least: checked, exists, unknown/indeterminate, probe URL, and non-fatal error/reason when useful.

---

# Activity Log

## 2026-05-13T05:18:49.032Z

- **description**: added (5 lines)

## 2026-05-13T21:57:05.749Z

- **priority**: MEDIUM → HIGH
- **description**: 5 lines → updated (14 lines)

## 2026-05-13T21:57:28.277Z

- **description**: updated

## 2026-05-13T22:07:20.373Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-05-14T03:17:50.119Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
