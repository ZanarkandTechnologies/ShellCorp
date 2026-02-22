# Fahrenheit

Single-brain, multi-hand AI operating system.

## Quick start

```bash
npm install
npm run build
cp fahrenheit.example.json ~/.fahrenheit/fahrenheit.json
npm run gateway
```

## CLI

- `npm run gateway` - start gateway server
- `npm run status` - print runtime status
- `npm run dev -- agent --message "hello"` - one-shot prompt
- `npm run dev -- channels login` - generate provider setup scaffold (n8n workflow + env checker)

Cron management examples:

```bash
npm run dev -- cron add --id daily-review --schedule "0 9 * * *" --prompt "Run daily review" --session "brain:main"
npm run dev -- cron list
npm run dev -- cron remove --id daily-review
```

Provider scaffold (n8n-first):

```bash
npm run dev -- channels login
```

Provider control endpoints:

- `GET /providers` - list provider setup and runtime status
- `GET /providers/:id/setup` - provider setup requirements
- `GET /providers/:id/status` - provider runtime status
- `POST /providers/:id/test` - inject a provider test event through the full gateway pipeline
