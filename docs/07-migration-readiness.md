# 07 — Migration Readiness

Análisis de riesgos, dependencias y plan de migración para reemplazar Supabase por un backend externo.

---

## 1. Dependencias críticas de Supabase

### 🔴 ALTA — Supabase Auth
**Impacto**: Login, sesión, refresh de tokens, roles, cambio de contraseña.

**Detalle**:
- `supabase.auth.signInWithPassword` → necesita reemplazo por endpoint de login propio
- `supabase.auth.getSession()` / `onAuthStateChange()` → reemplazar por gestión de tokens propia (JWT o similar)
- `supabase.auth.updateUser` → endpoint de cambio de contraseña
- Edge function `manage-users` usa `supabase.auth.admin.*` → necesita reemplazo completo
- El SDK automáticamente inyecta el JWT en headers de cada request a PostgREST → un backend REST propio necesitaría middleware de auth

**Archivos afectados**: `auth-store.ts`, `use-auth.tsx`, `Auth.tsx`, `MiCuenta.tsx`, `Usuarios.tsx`, `manage-users/index.ts`

### 🔴 ALTA — PostgREST (Data Layer)
**Impacto**: 100% del acceso a datos.

**Detalle**:
- Todo query usa `supabase.from("table").select/insert/update/delete`
- Joins vía PostgREST syntax: `select("*, products(cost_price)")`
- Filters: `.eq()`, `.in()`, `.gte()`, `.lte()`, `.ilike()`, `.not()`, `.or()`
- 22 archivos afectados directamente (ver doc 06)
- Multi-step transactions (venta, seña, compra) se ejecutan como operaciones secuenciales sin transacción DB real → riesgo de inconsistencia que un backend resolvería

**Archivos afectados**: Todos los archivos `*-store.ts`

### 🟡 MEDIA — Edge Function (`manage-users`)
**Impacto**: CRUD de usuarios.

**Detalle**:
- Usa `SUPABASE_SERVICE_ROLE_KEY` para admin API
- Verificación de rol server-side
- Reemplazable por endpoint REST en backend propio

**Archivos afectados**: `supabase/functions/manage-users/index.ts`, `Usuarios.tsx`, `return-store.ts`

### 🟡 MEDIA — RPC (`get_last_supplier_per_product`)
**Impacto**: Una vista en Stock (último proveedor por producto).

**Detalle**:
- Función SQL que hace `DISTINCT ON` sobre stock_movements + join suppliers
- Reemplazable por un endpoint REST o una query SQL directa en backend

### 🟢 BAJA — Row-Level Security
**Impacto**: Seguridad de acceso a datos.

**Detalle**:
- RLS policies actuales dependen de `auth.uid()` y `has_role()`
- Un backend propio manejaría autorización en la capa de aplicación (middleware)
- Las policies de RLS se volverían irrelevantes si no se usa PostgREST directamente

### 🟢 BAJA — Trigger `handle_new_user`
**Impacto**: Auto-creación de profile al crear usuario.

**Detalle**:
- Un backend propio puede hacer esto explícitamente al crear un usuario
- Si se mantiene PostgreSQL como DB, el trigger puede seguir existiendo

---

## 2. Features de Supabase NO utilizados

| Feature | Estado |
|---|---|
| Realtime | ❌ No usado |
| Storage | ❌ No usado |
| Vault | ❌ No usado |
| Database Webhooks | ❌ No usado |
| Cron Jobs | ❌ No usado |

Esto simplifica la migración — no hay suscripciones realtime ni uploads que migrar.

---

## 3. Riesgos de migración

### R1 — Transacciones no atómicas (🔴 Alta)
**Estado actual**: Operaciones como `createSale` hacen 5-6 queries secuenciales sin transacción. Si falla a mitad, el estado queda inconsistente (ej: sale insertada pero stock no descontado).

**Riesgo en migración**: Oportunidad de mejora — un backend propio puede wrappear en una transacción SQL real.

### R2 — Lógica de negocio en el frontend (🔴 Alta)
**Estado actual**: Cálculos de comisiones, COGS, margen, descuentos de promociones, verificación de stock — todo se hace en JavaScript del frontend.

**Riesgo**: Al migrar a un backend, hay que decidir qué lógica mover al server (recomendado) vs qué mantener en el frontend.

### R3 — Queries N+1 y agregación en JS (🟡 Media)
**Estado actual**: Varios stores hacen queries separadas y luego joinean/agregan en JavaScript (ej: `fetchResultadoRange` hace 4 queries + agrega en JS).

**Riesgo**: Un backend puede optimizar con queries SQL joins + GROUP BY.

### R4 — Límite de 1000 filas de Supabase (🟡 Media)
**Estado actual**: No hay manejo explícito del límite de 1000 filas en queries como `fetchCapitalCurrent` que selecciona TODOS los payments/expenses de toda la historia.

**Riesgo**: Puede ya estar causando datos incompletos en finanzas si hay >1000 filas. Un backend resolvería esto con paginación o queries agregadas.

### R5 — Hardcoded `created_by: "admin"` (🟢 Baja)
**Estado actual**: Varios stores usan `created_by: "admin"` en lugar del ID real del usuario. Esto dificulta auditoría.

**Riesgo**: En migración, se podría corregir pasando el user_id real desde el backend.

---

## 4. Orden de migración recomendado

### Fase 1 — API Layer sin romper la app (menor riesgo)
1. **Crear capa de abstracción**: Reemplazar imports directos de `supabase` en stores por un módulo `api-client` genérico
2. **Implementar endpoints READ-ONLY** primero: productos, stock, precios, categorías, reportes
3. **Validar** que la app funciona igual con el nuevo data layer

### Fase 2 — Auth
1. Implementar endpoints de auth propios (login, session, password change)
2. Reemplazar `AuthProvider` para usar tokens propios
3. Migrar edge function `manage-users` a un endpoint del backend

### Fase 3 — Operaciones de escritura
1. **POS** (createSale, createLayaway) → transacción atómica en backend
2. **Stock** (movements, purchases, counts) → transacciones atómicas
3. **Finanzas** (expenses, fund_movements, opening_balances)
4. **Clientes** (CRUD)
5. **Configuración** (tipos, categorías, variantes, price terms, promociones)

### Fase 4 — Limpieza
1. Remover Supabase SDK del frontend
2. Eliminar RLS policies (ya innecesarias)
3. Opcional: mantener PostgreSQL como DB o migrar

---

## 5. Archivos a crear/modificar para la migración

### Nuevos
- `src/lib/api-client.ts` — cliente HTTP genérico (fetch/axios) con auth headers
- Un archivo por módulo: `src/lib/api/*.ts` — funciones que llaman a los endpoints REST

### A modificar
- Todos los archivos `*-store.ts` → reemplazar `supabase.from(...)` por llamadas al `api-client`
- `src/hooks/use-auth.tsx` → reemplazar Supabase Auth por auth propia
- `src/lib/auth-store.ts` → reemplazar Supabase Auth SDK

### A eliminar (eventualmente)
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `supabase/functions/manage-users/index.ts`
- `supabase/config.toml`

---

## 6. Checklist pre-migración

- [ ] Definir stack del backend (Node.js/Express, Go, Python/FastAPI, etc.)
- [ ] Definir si se mantiene PostgreSQL o se cambia de DB
- [ ] Definir esquema de autenticación (JWT propio, OAuth, etc.)
- [ ] Documentar todos los endpoints necesarios (ver doc 02)
- [ ] Crear `api-client.ts` como capa de abstracción
- [ ] Implementar tests E2E antes de migrar para validar no-regresión
- [ ] Migrar reads primero, writes después
- [ ] Verificar que el límite de 1000 filas no esté causando bugs hoy
