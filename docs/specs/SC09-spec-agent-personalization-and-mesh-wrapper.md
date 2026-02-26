# SC09: Agent Personalization and Mesh/Image Wrapper Integration

## Scope

Define contracts and UI surfaces for agent visual personalization (profile, appearance, style presets, mesh/image wrappers) while preserving operational reliability and OpenClaw runtime behavior.

## Canonical References

- OpenClaw Multi-Agent Routing: https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing
- OpenClaw Plugins: https://docs.openclaw.ai/tools/plugin#plugins
- `ST01`: `docs/specs/studies/ST01-founder-direction-openclaw-personalization.md`
- `SC01`: `docs/specs/SC01-spec-openclaw-state-mapping.md`

## Product Rule

- Personalization is operator-owned cosmetic state.
- Personalization failures must degrade gracefully to defaults.
- Personalization cannot block sessions, routing, heartbeat, or orchestration flows.

## Data Contracts

### AgentAppearanceModel

- `agentId`
- `displayName`
- `profileImageUrl` (optional)
- `stylePreset`: `voxel | pixel_sprite | custom_mesh`
- `colorOverrides` (optional)
- `accessoryIds[]` (optional)
- `updatedAt`

### MeshWrapperAsset

- `assetId`
- `label`
- `category`: `agent_body | office_furniture | office_decor`
- `sourceType`: `bundled | user_uploaded`
- `url`
- `thumbnailUrl` (optional)
- `fileSizeBytes`
- `validated`
- `addedAt`

### ImageWrapperAsset

- `assetId`
- `label`
- `category`: `profile | sprite_sheet | texture_override`
- `sourceType`: `bundled | user_uploaded`
- `url`
- `dimensions` (optional)
- `fileSizeBytes`
- `validated`
- `addedAt`

### PersonalizationSidecarBlock

- `agentAppearances[]`
- `assetCatalog.meshes[]`
- `assetCatalog.images[]`
- `officeStylePreset`: `default | pixel | brutalist | cozy` (optional, contract-level in SC09)

## Safe Asset Pipeline

1. Operator uploads mesh/image from UI.
2. Client pre-validates type and size caps.
3. Backend validates parseability and structural limits.
4. Valid assets are stored and indexed in personalization catalog.
5. Invalid assets are rejected with actionable error text.

## Guardrails

- No executable content from uploaded assets.
- Missing assets trigger explicit fallback indicators.
- Asset references are optional and non-blocking.
- SC09 excludes cross-instance distribution of uploaded assets.

## UI Requirements

- Manage Agent includes an Appearance tab.
- Operators can choose style preset, profile image, and color overrides.
- Operators can assign validated custom mesh assets.
- Asset catalog view supports upload, preview, and removal.
- Office scene reflects assigned appearance with safe fallback.

## Acceptance Criteria

- Operators can update appearance and observe changes in office UI.
- Valid mesh/image uploads are assignable and persistent.
- Invalid assets are rejected with clear reasons.
- Asset/load failures fall back to defaults without runtime errors.
- Session/task/heartbeat operations remain unaffected by personalization changes.
