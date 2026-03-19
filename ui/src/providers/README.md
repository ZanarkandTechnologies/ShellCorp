# Providers

Purpose: app-level React providers that bridge gateway/OpenClaw data and expose stable UI context.

Public entrypoints:
- `office-data-provider.tsx`: office scene/team context
- `openclaw-adapter-provider.tsx`: adapter instance
- `gateway-provider.tsx`: gateway status/context
- `convex-provider.tsx`: Convex wiring

Minimal example:
```tsx
<OfficeDataProvider>
  <OfficeScene />
</OfficeDataProvider>
```

How to test:
- Pure office derivation logic is exercised through `office-data-provider.test.ts` via `office-data-mapper.ts`.
- Provider lifecycle changes should be validated with targeted UI tests where alias resolution is available, plus workspace typecheck when the repo baseline allows it.
