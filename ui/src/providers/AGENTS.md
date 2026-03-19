# Providers

- Keep React lifecycle/orchestration in provider files and move pure data shaping into helper modules when the logic needs standalone tests or reuse.
- Office data mapping must preserve hybrid-state assumptions: realtime status can stay reactive, but structural office/company state remains derived from the canonical OpenClaw sidecar/gateway snapshot. See `MEM-0176`, `MEM-0194`.
- Do not reintroduce synthetic project/team furniture through provider fallback paths unless the fallback is explicitly for adapter-empty failure state.
