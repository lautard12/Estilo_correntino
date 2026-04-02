# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Estilo Correntino** is a retail POS and inventory management SPA for a cutlery/grill items store. Built with React + TypeScript + Vite, backed by Supabase (PostgreSQL + Auth).

## Commands

```bash
npm run dev          # Start dev server on localhost:8080
npm run build        # Production build → dist/
npm run build:dev    # Development build
npm run lint         # ESLint
npm run preview      # Preview production build
npm run test         # Run Vitest (single run)
npm run test:watch   # Vitest in watch mode
```

## Architecture

### Tech Stack
- **Frontend:** React 18 + TypeScript, Vite, React Router v6
- **UI:** shadcn/ui (Radix UI) + Tailwind CSS (CSS variables with HSL colors)
- **State/Data:** TanStack React Query v5 + domain-specific stores in `src/lib/`
- **Forms:** React Hook Form + Zod validation
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)

### Structure
- **`src/pages/`** — 13 page components: Stock, Products, POS (Caja), Ventas, Senas, Finanzas, Reportes, Usuarios, Configuracion, Clientes, Auth, MiCuenta, CierreDelDia
- **`src/components/`** — Reusable components, with subdirectories per domain (`pos/`, `stock/`, `product/`, `config/`, `clientes/`) and `ui/` for all shadcn primitives
- **`src/lib/`** — Business logic stores (25+ files). Key ones: `supabase-store.ts` (core CRUD), `pos-store.ts`, `stock-store.ts`, `finanzas-store.ts`, `config-store.ts`, `layaway-store.ts`
- **`src/hooks/`** — Custom hooks including `use-auth.tsx` (Supabase Auth context)
- **`src/integrations/supabase/`** — Supabase client + auto-generated TypeScript types
- **`supabase/migrations/`** — 28 SQL migration files (source of truth for schema)
- **`docs/`** — Detailed domain documentation (sales logic, financial logic, config logic, API contracts, schema)

### Authentication & Routing
- Supabase Auth (email/password). Session in localStorage with auto-refresh.
- User roles: `encargado` (manager) vs regular user, from `profiles` table.
- All routes except `/auth` require authentication → redirect to `/auth` if unauthenticated.
- Default route redirects to `/stock`.

### Data Flow
- Supabase client in `src/integrations/supabase/client.ts`
- React Query wraps Supabase calls for server state caching/invalidation
- Domain stores in `src/lib/` contain query functions and mutations
- RLS (Row Level Security) policies enforced at the database layer

### Key Domain Concepts
- **Product types:** `JUEGOS_PARRILLEROS`, `CUCHILLOS_CHICOS`, `CUCHILLOS_MEDIANOS`, `CUCHILLOS_GRANDES`, `ACCESORIOS`
- **Sales channels:** `LOCAL`, `ONLINE`
- **Payment methods:** `EFECTIVO`, `MERCADOPAGO`, `TRANSFERENCIA`, etc.
- **Stock movements:** `PURCHASE`, `ADJUST`, `WASTE`, `SALE`
- **Senas (layaways):** Partial payments tracked via `pos_layaways` table

## Supabase

Environment variables (in `.env`, public keys safe to commit):
```
VITE_SUPABASE_URL=https://hbkbgrlxvsgiynrcnqbm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Edge Functions: `supabase/functions/manage-users/` — user management operations.

For schema details, check `/supabase/migrations/` (canonical) or `/docs/03-entities-and-schema.md` and `/docs/04-er-diagram.md`.

## Documentation

The `/docs/` directory has detailed domain docs — consult these before modifying business logic:
- `LOGICA_VENTAS.md` / `MODULO_VENTAS.md` — sales flow
- `LOGICA_FINANCIERA.md` — financial calculations
- `LOGICA_CONFIGURACION.md` — configuration module
- `02-api-contract-current.md` — store API contracts
- `05-auth-storage-security.md` — auth & security model
