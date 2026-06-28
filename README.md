# next_template

A reusable Next.js base for building web apps that share one design system and a
typed API layer. It ships with a complete foundation: App Router with route
groups, Tailwind v4 design tokens, light/dark theming, a shadcn-style component
library, JWT auth with refresh + RBAC, a typed fetch client aligned to the
companion `go_template` backend, form validation, and a Vitest test suite.

---

## Table of contents

- [Quick start](#quick-start)
- [Architecture overview](#architecture-overview)
- [Project structure](#project-structure)
- [Routing (App Router + route groups)](#routing-app-router--route-groups)
- [Route protection (proxy.ts)](#route-protection-proxyts)
- [Theming & design system](#theming--design-system)
- [UI components](#ui-components)
- [State management](#state-management)
- [Auth (JWT + refresh)](#auth-jwt--refresh)
- [Networking (API client)](#networking-api-client)
- [Forms & validation](#forms--validation)
- [Environment config](#environment-config)
- [Testing](#testing)
- [Linting & formatting](#linting--formatting)
- [Creating a new app from this template](#creating-a-new-app-from-this-template)
- [Dependencies](#dependencies)

---

## Quick start

```bash
cp .env.example .env.local    # optional — defaults work for local dev
npm install
npm run dev                   # http://localhost:3000
```

The template includes marketing, auth, dashboard, and admin surfaces wired to
the API. For full auth/admin flows, run the companion `go_template` backend at
`NEXT_PUBLIC_API_URL` (default `http://localhost:8080`).

---

## Architecture overview

| Concern | Tool | Where |
|---------|------|-------|
| Framework | Next.js 16 (App Router) | `src/app/` |
| Language | TypeScript (strict) | `tsconfig.json` |
| Styling / tokens | Tailwind CSS v4 (CSS-first) | `src/app/globals.css` |
| Theming | `next-themes` | `components/providers.tsx` |
| UI primitives | shadcn-style + `class-variance-authority` | `src/components/ui/` |
| Icons | `lucide-react` | throughout |
| Forms | `react-hook-form` + `zod` | `src/lib/validations.ts` |
| Auth state | React Context | `src/lib/auth/context.tsx` |
| Networking | typed `fetch` wrapper | `src/lib/api/` |
| Route protection | Next.js 16 `proxy.ts` | `src/proxy.ts` |
| Toasts | `sonner` | `components/providers.tsx` |
| Tests | Vitest + Testing Library | `*.test.ts(x)` |

There is **no** global store (Redux/Zustand) or data-fetching cache (React
Query/SWR): auth lives in Context, theme in `next-themes`, and pages fetch on
mount. These are intentional, documented upgrade points.

---

## Project structure

```
src/
├── proxy.ts                    # Server-side auth redirects (Next 16 "middleware")
├── app/
│   ├── layout.tsx              # Root layout (fonts, providers)
│   ├── globals.css             # Tailwind v4 + design tokens
│   ├── not-found.tsx
│   ├── (marketing)/            # Public site (/, /about) — header + footer
│   ├── (auth)/                 # /login, /register
│   ├── dashboard/              # Authenticated user area
│   ├── admin/
│   │   ├── (auth)/             # /admin/login, /admin/register
│   │   └── (protected)/        # /admin, /admin/users, /admin/users/[id]
├── components/
│   ├── providers.tsx           # Theme + auth + toasts
│   ├── theme-toggle.tsx
│   ├── ui/                     # Primitives (button, input, card, badge, ...)
│   ├── auth/                   # Login/register forms, social buttons
│   ├── dashboard/              # Stat card, activity list, greeting
│   ├── layout/                 # Shell, header, footer, nav, RequireAuth
│   └── brand/logo.tsx
└── lib/
    ├── config.ts               # Centralized env config
    ├── utils.ts                # cn() + helpers
    ├── validations.ts          # Zod schemas
    ├── api/                    # client + typed endpoints (auth, users)
    ├── auth/                   # Context + cookie token store
    └── hooks/                  # Shared hooks (useMounted)
```

---

## Routing (App Router + route groups)

All routes live under `src/app/`. Parenthesized folders are **route groups**
(they share layout but add no URL segment):

| Path | Description |
|------|-------------|
| `/`, `/about` | Marketing pages (`(marketing)`) |
| `/login`, `/register` | User auth (`(auth)`) |
| `/dashboard`, `/dashboard/profile`, `/dashboard/settings` | User area |
| `/admin/login`, `/admin/register` | Admin auth |
| `/admin`, `/admin/users`, `/admin/users/[id]` | Admin console |

Most interactive pages are `"use client"`; marketing and root layout are server
components.

---

## Route protection (proxy.ts)

`src/proxy.ts` is the Next.js 16 successor to `middleware.ts`. It guards routes
server-side via the JWT cookie:

- Matches `/dashboard/*`, `/admin/*`, `/login`, `/register`.
- Redirects unauthenticated users to login (or `/admin/login` for admin),
  preserving a `?redirect=` param.
- Redirects already-authenticated users away from auth pages.
- Enforces `role === "admin"` for `/admin/*`.

A client-side `RequireAuth` guard in the dashboard/admin layouts provides a
spinner + fallback redirect.

---

## Theming & design system

Built on **Tailwind v4 CSS variables** + `next-themes`, with no
`tailwind.config.js`. Tokens are defined in `src/app/globals.css`:

```css
:root        { --primary: oklch(...); --background: oklch(...); /* light */ }
.dark        { --primary: oklch(...); --background: oklch(...); /* dark  */ }
@theme inline { --color-primary: var(--primary); /* -> bg-primary, text-primary */ }
```

Use tokens instead of hardcoding colors:

```tsx
<div className="bg-background text-foreground" />
<button className="bg-primary text-primary-foreground rounded-lg" />
<span className="text-muted-foreground" />
```

- Semantic colors in **oklch**: `background`, `foreground`, `primary`,
  `secondary`, `muted`, `destructive`, `success`, …
- Radius scale `--radius-sm … --radius-xl`, plus `shadow-card` and
  `bg-brand-gradient` utilities.
- Dark mode via `@custom-variant dark` + `next-themes` (`attribute="class"`).
- Fonts: `Geist` / `Geist_Mono` via `next/font` in `layout.tsx`.

Switch theme from any client component:

```tsx
const { setTheme } = useTheme();      // "light" | "dark" | "system"
setTheme("dark");
```

`useMounted()` (`lib/hooks`) guards theme-dependent UI against hydration
mismatch.

---

## UI components

Hand-rolled, shadcn-style primitives in `src/components/ui/` (CVA variants +
`cn()`, no shadcn CLI or Radix dependency):

| Component | Purpose |
|-----------|---------|
| `Button` | Variants + loading state |
| `Input` / `PasswordInput` / `Label` | Form fields (+ password toggle) |
| `Card` (+ header/title/content/footer) | Surface container |
| `Badge`, `Avatar`, `Skeleton` | Status / identity / loading |

Feature components build on these: auth forms (`components/auth/`), dashboard
widgets (`components/dashboard/`), and `DashboardShell` with sidebar + mobile
bottom nav (`components/layout/`).

---

## State management

| Layer | Approach |
|-------|----------|
| Global auth | React Context (`AuthProvider` / `useAuth()`) |
| Theme | `next-themes` |
| Forms | `react-hook-form` (local per form) |
| Page data | `useState` + `useEffect` fetch-on-mount |
| Toasts | `sonner` |

No external store/cache by design — React Query or SWR is the suggested upgrade
for server state.

---

## Auth (JWT + refresh)

Auth state lives in `src/lib/auth/context.tsx`; tokens are stored as cookies via
`src/lib/auth/tokens.ts`.

```tsx
const { user, login, register, logout, isLoading } = useAuth();
await login({ email, password });
```

On hydrate, the JWT is decoded from cookies and the current user is fetched from
the API. Roles (`user`/`admin`) drive both the proxy guard and conditional UI.

> Security note: tokens are stored in client-readable cookies (`nt_access_token`,
> `nt_refresh_token`) for simplicity. Move to httpOnly cookies for production
> hardening — see `tokens.ts`.

---

## Networking (API client)

A typed `fetch` wrapper (no axios) in `src/lib/api/`:

| File | Role |
|------|------|
| `client.ts` | `api.get/post/put/delete`, `ApiError`, auto refresh on 401 |
| `types.ts` | Types mirroring the Go backend `Envelope<T>` |
| `auth.ts` | `/api/v1/auth/register`, `/login` |
| `users.ts` | User CRUD + `adminApi` for `/api/admin/users` |

```ts
import { api } from "@/lib/api/client";
import { usersApi } from "@/lib/api/users";

const me = await usersApi.get(id);
await api.post("/api/v1/something", { body });
```

- Base URL from `config.apiBaseUrl`.
- Bearer token attached from cookies.
- Transparent refresh via `POST /api/v1/auth/refresh` (deduped in-flight).
- Parses the `{ success, data, error, meta }` envelope and throws typed
  `ApiError` (with `code`, `status`, `fields`).

---

## Forms & validation

`react-hook-form` with `zod` resolvers; schemas centralized in
`src/lib/validations.ts`:

```tsx
const form = useForm({ resolver: zodResolver(loginSchema) });
```

Server validation errors returned by the API (`fields`) map back onto the form.

---

## Environment config

Config comes from `.env.local` (git-ignored; `.env.example` is the committed
template) and is centralized in `src/lib/config.ts` with fallbacks so the app
runs without env files.

```env
NEXT_PUBLIC_APP_NAME=Next Template
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Both are `NEXT_PUBLIC_*` (browser-accessible). Cookie names are defined in
`config.ts` (`nt_access_token`, `nt_refresh_token`).

---

## Testing

```bash
npm test          # vitest run
npm run test:watch
```

Vitest + Testing Library with jsdom (`src/test/setup.ts`). Tests are co-located
(`*.test.ts(x)`) and cover utils, the API client, token store, and key UI/
dashboard components.

---

## Linting & formatting

```bash
npm run lint        # ESLint (flat config, next/core-web-vitals + TS)
npm run typecheck   # tsc --noEmit
npm run format      # prettier --write . (+ tailwind class sorting)
```

Config: `eslint.config.mjs`, `.prettierrc.json` (with
`prettier-plugin-tailwindcss`), `tsconfig.json` (strict, `@/*` alias).

---

## Creating a new app from this template

1. Copy the repo (or use it as a starter).
2. Update `name` in `package.json` and the app name in `.env.local`.
3. Set `NEXT_PUBLIC_API_URL` to your backend (pairs with `go_template`).
4. Rebrand: tokens in `src/app/globals.css`, `components/brand/logo.tsx`, fonts
   in `layout.tsx`.
5. Keep `src/components/ui/` as your design system; build pages under `src/app/`
   using route groups, the API client, and `useAuth()`.
6. Remove example surfaces (marketing/admin) you don't need.

---

## Dependencies

| Package | Use |
|---------|-----|
| `next` / `react` / `react-dom` | Framework + UI runtime |
| `next-themes` | Light/dark/system theming |
| `tailwindcss` (v4) + `@tailwindcss/postcss` | Styling / design tokens |
| `class-variance-authority` + `clsx` + `tailwind-merge` | Variant-based styling (`cn()`) |
| `lucide-react` | Icons |
| `react-hook-form` + `@hookform/resolvers` + `zod` | Forms + schema validation |
| `sonner` | Toast notifications |
| `typescript` | Type checking (dev) |
| `eslint` + `eslint-config-next` | Linting (dev) |
| `prettier` + `prettier-plugin-tailwindcss` | Formatting (dev) |
| `vitest` + Testing Library + `jsdom` | Tests (dev) |
