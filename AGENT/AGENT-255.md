---
title: "Re-adopt strict constrainedSampling with strict-valid schema emission (harness-gated)"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: MEDIUM
assignee: "sandpiper-dev"
reporter: AGENT
created_at: 2026-08-07T15:15:44.996Z
updated_at: 2026-08-10T18:38:58.661Z
depends_on:
  - AGENT-252
---

# Re-adopt strict constrainedSampling with strict-valid schema emission (harness-gated)

Re-adopt constrainedSampling strict:'prefer' across the 9 parameter-bearing tools, this time with strict-VALID schema emission - the AGENT-254 investigation proved pi-ai gates purely on model capability (resolveJsonSchemaStrictSampling inspects no schema shape) and forwards tool.parameters verbatim, so opting in is only safe when our emitted JSON Schema satisfies OpenAI-strict requirements in full: additionalProperties:false at EVERY object level (including nested union arms like web_fetch's filter), every property present in required, optionals expressed as nullable unions rather than omission, no unsupported keywords.

GATED ON: the AGENT-249 integration harness (specifically AGENT-252's mock provider). The mock provider should implement OpenAI-strict schema validation as a scriptable behavior, giving a headless, zero-egress verification loop: every re-opted tool's schema gets validated by the mock's strict validator in CI, which is exactly the check whose absence let the original AGENT-240 adoption ship broken (its falsification only covered graceful degradation on UNSUPPORTED models; the strict-ACTIVATED path was unverifiable without live calls at the time).

Context: original adoption AGENT-240 (approved 2026-08-06, regressed-and-reverted under AGENT-254 2026-08-07 with mechanism recorded). Companion upstream-ask candidate (Doug-gated pile, alongside AGENT-245 and the EntryRenderOptions outputPad ask): pi's 'prefer' variant silently opts schemas into a mode their shape cannot satisfy, which contradicts prefer's transparent-fallback promise - upstream should either transform schemas to strict form on activation or inspect shape and decline; capability-only gating + verbatim forwarding is the trap that produced this regression.

CORRECTION (2026-08-07, Doug): the "upstream ask" framing on strict:'prefer' recorded here and in AGENT-254 is WITHDRAWN - it rested on a misreading by the coordinator, not on pi's actual contract.

Pi documents prefer as: "uses provider-side strict schema enforcement when supported and otherwise falls back to normal tool calling." The fallback condition is PROVIDER CAPABILITY, not schema validity, and the implementation matches that exactly (resolveJsonSchemaStrictSampling: supported -> strict:true, unsupported -> normal, unsupported+require -> throw). prefer is a capability switch, not a safety net. The coordinator read "prefer" as connoting "try, and back off if there is trouble" and built an upstream-bug case on that connotation rather than on the documented behavior.

Correct attribution: AGENT-240 was OUR bug. We opted 9 tools into provider-side strict enforcement without meeting strict mode's schema requirements (additionalProperties:false at every object level, every property in required with optionality expressed as nullable unions). Pi did what it said it would do.

Residual, recorded as a DX observation and explicitly NOT an upstream ask (per the AGENTS.md rule against ticketing upstream wishes): strict mode's schema requirements are not stated where the flag is documented, and violating them surfaces as a provider-side request rejection at turn time rather than a registration-time error. Sharp edge, not a defect. No action.

This does not change this task's work: re-adoption still requires emitting strict-valid schemas and verifying them headlessly, which is exactly what the mock-provider gate is for.

---

STRICT-MODE REQUIREMENTS, from pi's constrained-sampling documentation (2026-08-07) - these define the bar re-adoption must clear:

Strict JSON-schema sampling is live across FIVE provider families, not just OpenAI: OpenAI, Anthropic, supported Amazon Bedrock Converse models, Mistral, and Gemini 3 via the Google Generative AI and Vertex adapters. Their requirements are NOT identical, so "strict-valid" is an intersection, not a single target:
- OpenAI: additionalProperties:false at every object level, every property present in required, optionality expressed as nullable unions rather than omission.
- Google: VALIDATED function-calling mode (or ANY when explicitly requested), which enforces required parameters. Earlier Gemini versions fall back for prefer and reject require precisely because they do not enforce required params.
- Bedrock: strict-tool capability is generated from model structured-output metadata, and custom Bedrock model definitions can override compat.supportsStrictMode - meaning strict can activate for a model we have not verified, via config we do not control.

VALIDATION PRECEDENT, same file: pi already does exactly the kind of pre-flight schema validation the strict path lacks - but for the GRAMMAR variant. inferGrammarInputProperty (constrained-sampling.js) requires an object schema with exactly one required string property and throws specific local errors otherwise (wrong type, wrong required count, missing properties entry). That is the model for our own validation: a local check that fails loudly at registration or in CI, before any request is dispatched, rather than surfacing as a provider-side rejection mid-turn. Our mock provider's strict validator should mirror the strictest union above.

ALSO NOTED, not currently applicable: the grammar variant (OpenAI Lark or regex, Lark preferred when both supplied) constrains the CONTENT of a single string property, requires exactly one required string property, and is gated on compat.supportsOpenAIGrammarTools (GPT-5+ on passthrough endpoints only - off for gateways like OpenRouter that normalize tool schemas). None of our 12 tools has a shape or a value domain that would benefit; revisit only if a tool ever takes a grammar-constrained input such as a query language or pattern.

---

SOURCE: all of the above is documented in node_modules/@earendil-works/pi-ai/README.md - start there rather than re-deriving from dist sources. The 2026-08-07 investigation traced constrained-sampling behavior through compiled JS across several sessions when the README states it plainly, and the one conclusion that turned out wrong (the "upstream bug" framing) came precisely from having the mechanism right and the contract unread. Guidance added to docs/dev/pi-extension-development.md.

---

# Activity Log

## 2026-08-07T22:10:05.979Z

- **description**: 5 lines → updated (15 lines)

## 2026-08-07T22:11:44.982Z

- **description**: 15 lines → updated (28 lines)

## 2026-08-07T22:12:36.244Z

- **description**: 28 lines → updated (32 lines)

## 2026-08-10T17:37:46.197Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → sandpiper-dev

## 2026-08-10T18:38:58.604Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-10T18:38:58.662Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: WONTFIX
