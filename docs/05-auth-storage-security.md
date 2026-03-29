# 05 — Auth, Storage & Security

## 1. Flujo de autenticación

### Login
- Pantalla `/auth` → `supabase.auth.signInWithPassword({ email, password })`
- No hay registro público. Las cuentas se crean exclusivamente por el encargado vía edge function `manage-users` (action: `create`) que usa `supabase.auth.admin.createUser` con `email_confirm: true`
- El frontend redirige a `/stock` tras login exitoso

### Sesión
- `supabase.auth.getSession()` en el init de `AuthProvider`
- `supabase.auth.onAuthStateChange()` para cambios de sesión en tiempo real
- Session se persiste en `localStorage` (`persistSession: true`, `autoRefreshToken: true`)
- El token JWT se envía automáticamente por el SDK en cada request a Supabase

### Refresh de token
- Manejado automáticamente por el SDK de Supabase (`autoRefreshToken: true`)
- No hay lógica custom de refresh

### Logout
- `supabase.auth.signOut()` → limpia session del localStorage

### Cambio de contraseña
- `supabase.auth.updateUser({ password })` desde `/mi-cuenta`
- Reset por admin: edge function `manage-users` → `supabase.auth.admin.updateUserById(userId, { password })`

---

## 2. Roles y permisos

### Enum
```sql
CREATE TYPE public.app_role AS ENUM ('vendedor', 'encargado');
```

### Tabla `user_roles`
- Almacena `user_id` + `role`
- Constraint `UNIQUE(user_id, role)`

### Función `has_role`
```sql
CREATE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
```
- Usada en RLS policies para verificar rol

### Carga del rol en frontend
- `fetchUserRole(userId)` → `SELECT role FROM user_roles WHERE user_id = $1 LIMIT 1`
- Se almacena en `AuthProvider` context → `useAuth().role`, `useAuth().isEncargado`

### Restricciones por pantalla
| Pantalla | Restricción |
|---|---|
| Configuración | `isEncargado` — renderiza "sin permisos" si no |
| Usuarios | Implícito via edge function (verifica `encargado` server-side) |
| Resto | Solo requiere `authenticated` |

---

## 3. Row-Level Security (RLS)

### Tablas con RLS restrictivo por rol

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `user_roles` | Propio usuario O encargado | Encargado | Encargado | Encargado |
| `profiles` | Authenticated | Solo propio | Solo propio | ❌ No permitido |
| `customers` | Authenticated | Authenticated | Encargado | Encargado |
| `promotions` | Authenticated | Encargado | Encargado | Encargado |
| `promotion_products` | Authenticated | Encargado | Encargado | Encargado |
| `product_types` | Authenticated | Encargado | Encargado | Encargado |
| `product_categories` | Authenticated | Encargado | Encargado | Encargado |
| `variant_sets` | Authenticated | Encargado | Encargado | Encargado |
| `variant_values` | Authenticated | Encargado | Encargado | Encargado |
| `price_terms` | Authenticated | Encargado | Encargado | Encargado |
| `audit_log` | Encargado | Authenticated | ❌ | ❌ |

### Tablas con RLS abierto (`true` for all)

| Tabla |
|---|
| products |
| stock_balances |
| stock_movements |
| pos_sales |
| pos_sale_items |
| pos_payments |
| pos_layaways |
| product_prices |
| price_settings |
| expenses |
| fund_movements |
| cash_opening_balances |
| inventory_counts |
| inventory_count_lines |
| suppliers |
| categories |

> ⚠️ Estas tablas tienen policies `USING (true)` / `WITH CHECK (true)` — accesibles por cualquier usuario con el anon key. Esto es un riesgo de seguridad si se expone la app sin autenticación obligatoria.

---

## 4. Storage Buckets

No hay storage buckets configurados en el proyecto.

---

## 5. Edge Functions

### `manage-users`
- **Ubicación**: `supabase/functions/manage-users/index.ts`
- **Propósito**: Gestión de usuarios (CRUD) usando `supabase.auth.admin.*`
- **Seguridad**: Verifica que el caller tenga rol `encargado` vía token JWT + query a `user_roles`
- **Acciones**: `list`, `create`, `update-role`, `reset-password`, `delete`
- **Usa**: `SUPABASE_SERVICE_ROLE_KEY` (disponible como env var en edge functions)

---

## 6. Realtime

No se usa Supabase Realtime actualmente. No hay suscripciones `postgres_changes` en el código.

---

## 7. RPC (Remote Procedure Calls)

| Función | Uso |
|---|---|
| `get_last_supplier_per_product()` | Pantalla Stock — obtiene último proveedor por producto |
| `has_role(_user_id, _role)` | Solo usada internamente en RLS policies |

---

## 8. Triggers

### `handle_new_user`
- **Tabla**: `auth.users` (attached via trigger — no verificado directamente, pero la función existe)
- **Acción**: Al crear usuario, auto-inserta en `profiles` con `display_name`

### `validate_payment_method_fund`
- Valida que `fund` sea `EFECTIVO` o `MERCADOPAGO`
- Tabla target: no verificado (probablemente `pos_payments` o `expenses`)

---

## 9. Dependencias de Supabase

| Característica | Usado | Detalle |
|---|---|---|
| Auth (signIn/signOut/session) | ✅ | Core del login |
| Auth Admin API | ✅ | Edge function manage-users |
| PostgREST (queries via SDK) | ✅ | Todo el data layer |
| RPC | ✅ | 1 función: get_last_supplier_per_product |
| Edge Functions | ✅ | 1 función: manage-users |
| Realtime | ❌ | No usado |
| Storage | ❌ | No usado |
| Vault | ❌ | No usado |
