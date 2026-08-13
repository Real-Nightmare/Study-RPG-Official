# Study RPG — Frontend

React 19 + Vite 7 + TypeScript + Tailwind CSS + Radix UI. The client for the
Studyield / Study RPG NestJS API (`../backend`).

## Stack

- **React 19** with `react-router-dom` (v7) client routing
- **Tailwind CSS** + shadcn-style Radix UI components (`src/components/ui`)
- **Zustand** stores (`src/stores`), **TanStack Query**, **axios** (`src/services`)
- **i18next** with 15 locale files under `src/locales`
- **Socket.IO client** for live chat / problem-solver / quiz streaming

## Development

```bash
npm ci
npm run dev        # http://localhost:5189
npm run build      # tsc -b && vite build → dist/
npm run lint       # eslint . (0 errors / 14 known warnings)
npm test           # vitest run
```

The API base URL comes from `VITE_API_URL` (defaults to `http://localhost:3010`
in dev). See `.env.example`.

## Deploying to Cloudflare Pages (auto)

Pushing to `main` runs `.github/workflows/deploy-frontend-cloudflare.yml`,
which builds `dist/` and uploads it to Cloudflare Pages with wrangler.

**How billing actually works here:** the frontend is a **pure static site —
no Pages Functions, no Worker scripts**. Cloudflare does not bill static
asset requests on Pages at all: they are **free and unlimited**, and never
touch the shared **Workers + Pages Functions** 100k/day quota (see
`pages/functions/pricing`). `public/_routes.json` excludes *every* route from
Functions invocation, so even if someone adds a `functions/` directory later,
all requests stay in the free-and-unlimited static pool:

- `public/_routes.json` — exclude-all guard: no route can ever invoke a
  Pages Function (requests stay static = free & unlimited)
- `public/_redirects` — SPA fallback (`/* → /index.html 200`), an edge rule
- `public/_headers` — hashed `/assets/*` cached immutable (1 year); `index.html`
  and `sw.js` revalidated every load so deploys propagate instantly
- `wrangler.toml` — Pages project config for local `wrangler pages deploy`

### Required GitHub configuration

| Kind | Name | Value |
|------|------|-------|
| Secret | `CLOUDFLARE_API_TOKEN` | API token with **Cloudflare Pages: Edit** permission |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| Variable | `CLOUDFLARE_PROJECT_NAME` | Pages project name (defaults to `study-rpg`) |
| Variable | `VITE_API_URL` | **Production API origin** (e.g. `https://api.study-rpg.com`) |

The first deploy creates the Pages project automatically. Point a custom domain
at it from the Cloudflare dashboard and add that origin to the backend's
`CORS_ORIGINS` allowlist (or reverse-proxy `/api` to the backend on the same
domain). Full details: `docs/deployment/hosting.md`.

## Layout

| Path | Purpose |
|------|---------|
| `src/pages/` | Route pages (public + `/dashboard/*`) |
| `src/components/` | Shared + feature components (`ui/` = shadcn-style primitives) |
| `src/services/` | API clients + endpoint maps (`config/api.ts`) |
| `src/stores/` | Zustand stores |
| `src/locales/` | i18n resources (15 locales) |
| `public/` | Static assets + Cloudflare Pages `_headers`/`_redirects`/`sw.js` |
