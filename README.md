# Bahamut

Single-brain, multi-hand AI operating system.

## Quick start

```bash
npm install
npm run build
cp bahamut.example.json ~/.bahamut/bahamut.json
npm run gateway
```

## CLI

- `npm run gateway` - start gateway server
- `npm run status` - print runtime status
- `npm run dev -- agent --message "hello"` - one-shot prompt

Cron management examples:

```bash
npm run dev -- cron add --id daily-review --schedule "0 9 * * *" --prompt "Run daily review" --session "brain:main"
npm run dev -- cron list
npm run dev -- cron remove --id daily-review
```
