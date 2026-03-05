---
name: video-generator
description: Produce short-form video assets for growth experiments and affiliate content loops.
---

# Video Generator

## Goal

Create a publish-ready short video from a task brief with clear CTA and tracking-ready link context.

## Preconditions

- inference.sh CLI installed and authenticated:
  - `npx skills add inference-sh/skills@agent-tools`
  - `infsh login`
- Team id and workspace output directory are known.

## Inputs

- Task brief from kanban
- Topic, angle, CTA, and offer details
- Target platform constraints (duration, aspect ratio, text limits)

## Outputs

- Script draft
- Caption copy
- Output asset path or publishing-ready package
- Optional content metadata for later attribution

## Workflow

1. Convert task brief into a single hypothesis-driven content angle.
2. Generate a short script with hook -> value -> CTA.
3. Produce a video artifact using inference.sh CLI (`infsh app run ...`).
4. Return title/caption variants for PM selection or A/B testing.
5. Attach source metadata so distribution can attribute performance.

## Concrete Command Pattern

```bash
# Text-to-video (fast baseline)
infsh app run google/veo-3-1-fast --input "{
  \"prompt\": \"$VIDEO_PROMPT\"
}"
```

```bash
# AI avatar / talking-head UGC
infsh app run bytedance/omnihuman-1-5 --input "{
  \"image_url\": \"$AVATAR_IMAGE_URL\",
  \"audio_url\": \"$NARRATION_AUDIO_URL\"
}"
```

```bash
# Programmatic render (template-driven)
infsh app run infsh/remotion-render --input "{
  \"code\": \"$REMOTION_CODE\",
  \"duration_seconds\": 30,
  \"fps\": 30,
  \"width\": 1080,
  \"height\": 1920
}"
```

```bash
# Optional support steps
infsh app run google/gemini-3-1-flash-image-preview --input "{\"prompt\":\"$THUMBNAIL_PROMPT\"}"
infsh app run infsh/birefnet --input "{\"image_url\":\"$IMAGE_URL\"}"
```

Save resulting artifact URLs/paths into the task notes and log spend:

```bash
npm run shell -- team funds spend \
  --team-id "$TEAM_ID" \
  --amount "$SPEND_CENTS" \
  --source inference_sh \
  --note "video generation model=$MODEL_NAME"
```

## Guardrails

- Keep claims factual and avoid unsupported guarantees.
- Include clear CTA language that maps to measurable links.
- If generation fails, return a retry plan with smallest next step.
- Do not overwrite existing output files; version outputs (`v1`, `v2`, etc.).
