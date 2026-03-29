# Lógica del Sistema de Ventas — Documentación completa

> Documento de referencia para replicar la lógica de ventas, historial, devoluciones y finanzas en otro proyecto.

---

## 1. Arquitectura general

**Stack**: React + TypeScript + Supabase (Postgres) + TanStack React Query + shadcn/ui + Tailwind CSS

**Archivos clave**:
- `src/lib/pos-store.ts` — Lógica del POS (crear ventas, señas, productos activos)
- `src/lib/config-store.ts` — Catálogo de configuración (tipos, categorías, variantes, price_terms)
- `src/lib/return-store.ts` — Fetch de historial de ventas + procesamiento de devoluciones
- `src/lib/finanzas-store.ts` — Lógica financiera (resultado, capital actual, gastos, movimientos de fondos)
- `src/pages/Ventas.tsx` — UI del historial de ventas con filtros y devoluciones
- `src/pages/Finanzas.tsx` — UI de finanzas (resultado + gastos + capital)
- `src/pages/POS.tsx` — Pantalla del punto de venta
- `src/components/pos/CheckoutModal.tsx` — Modal de cobro

---

## 2. Schema de base de datos

### 2.1 `pos_sales` — Ventas
| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | uuid | gen_random_uuid() | PK |
| channel | text | — | `"LOCAL"` o `"ONLINE"` |
| price_term | text | — | Code del price_term elegido (ej: `"EFECTIVO"`, `"CREDITO_1"`) |
| status | text | `'COMPLETED'` | `"COMPLETED"`, `"LAYAWAY"`, `"CANCELLED"` |
| total | integer | 0 | Total en pesos (moneda sin decimales) |
| subtotal_local | integer | 0 | Subtotal de items owner=LOCAL |
| subtotal_restaurant | integer | 0 | Legacy, siempre 0 |
| delivery_fee | integer | 0 | Costo de envío |
| created_by | text | `'admin'` | UUID del usuario o `"admin"` |
| created_at | timestamptz | now() | Timestamp de creación |

**Notas**:
- `total = subtotal_local + delivery_fee`
- Los montos son **enteros** (ej: $1.500 = 1500)
- `price_term` referencia el `code` de la tabla `price_terms`

### 2.2 `pos_sale_items` — Líneas de venta
| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | uuid | gen_random_uuid() | PK |
| sale_id | uuid | — | FK → pos_sales.id |
| owner | text | — | `"LOCAL"` (único owner en uso) |
| item_type | text | — | `"PRODUCT"` |
| product_id | uuid | null | FK → products.id |
| name_snapshot | text | — | Nombre del producto al momento de la venta |
| variant_snapshot | text | `''` | Variante (ej: "25cm", "5 piezas") |
| qty | integer | — | Cantidad vendida |
| unit_price | integer | — | Precio unitario al momento de la venta |
| line_total | integer | — | `qty × unit_price` |
| notes | text | `''` | Notas del ítem |

### 2.3 `pos_payments` — Pagos
| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | uuid | gen_random_uuid() | PK |
| sale_id | uuid | — | FK → pos_sales.id |
| payment_method | text | — | Code del price_term (ej: `"EFECTIVO"`, `"DEBITO"`) |
| fund | text | — | `"EFECTIVO"` o `"MERCADOPAGO"` (definido por el price_term) |
| amount | integer | — | Monto pagado (incluye recargo si aplica) |
| installments | integer | 1 | Cuotas |
| commission_pct | numeric | 0 | Porcentaje de comisión (= surcharge_pct del term) |
| commission_amount | integer | 0 | Monto de comisión en pesos |

**Regla de fund**: se toma del campo `fund` del `price_term` seleccionado. Fallback: EFECTIVO si el método es "EFECTIVO", sino MERCADOPAGO.

**Comisiones**: el `surcharge_pct` del price_term se usa como comisión del procesador. El recargo al cliente = comisión retenida, por lo que el neto ≈ precio base.

### 2.4 `price_terms` — Opciones de cobro
| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | uuid | gen_random_uuid() | PK |
| code | text | — | Código único (ej: `"EFECTIVO"`, `"CREDITO_1"`) |
| label | text | — | Nombre visible (ej: "Crédito 1 cuota") |
| surcharge_pct | numeric | 0 | Recargo al cliente / comisión procesador (%) |
| default_installments | integer | null | Cuotas por defecto |
| fund | text | `'EFECTIVO'` | Fondo destino: `"EFECTIVO"` o `"MERCADOPAGO"` |
| sort_order | integer | 0 | Orden de visualización |
| is_active | boolean | true | Si está habilitada |

**Lógica clave**: cada price_term unifica lo que antes eran conceptos separados (método de pago + plazo + recargo + comisión). El vendedor solo elige UNA opción y todo se determina automáticamente.

### 2.5 `products` — Productos
| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | uuid | gen_random_uuid() | PK |
| name | text | — | Nombre del producto |
| type | text | — | Tipo (texto legacy) |
| category | text | `''` | Categoría (texto legacy) |
| type_id | uuid | null | FK → product_types.id |
| category_id | uuid | null | FK → product_categories.id |
| variant_label | text | `''` | Etiqueta de variante |
| variant_set_id | uuid | null | FK → variant_sets.id |
| variant_value_id | uuid | null | FK → variant_values.id |
| sku | text | `''` | Código SKU |
| cost_price | integer | 0 | Costo de compra (para COGS) |
| track_stock | boolean | true | Si controla stock |
| min_stock | integer | 0 | Stock mínimo de alerta |
| is_active | boolean | true | Si está activo para venta |

### 2.6 `product_prices` — Precios por canal/término
| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | uuid | gen_random_uuid() | PK |
| product_id | uuid | — | FK → products.id |
| channel | text | — | `"LOCAL"` o `"ONLINE"` |
| term | text | — | Code del price_term (ej: `"EFECTIVO"`, `"CREDITO_1"`) |
| price | numeric | 0 | Precio para esa combinación canal+term |

**Lógica de precios**:
- Cada producto tiene precio por combinación canal × term
- Solo se cargan manualmente los precios BASE (term con surcharge_pct = 0)
- Los precios con recargo se calculan automáticamente: `BASE × (1 + surcharge_pct / 100)`

### 2.7 `stock_balances` — Saldo de stock
| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| product_id | uuid | — | PK, FK → products.id (1:1) |
| qty_on_hand | integer | 0 | Cantidad en mano |

### 2.8 `stock_movements` — Movimientos de stock
| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | uuid | gen_random_uuid() | PK |
| product_id | uuid | — | FK → products.id |
| type | text | — | `"SALE"`, `"RETURN"`, `"ADJUSTMENT"`, `"PURCHASE"` |
| qty | integer | — | Cantidad movida |
| reason | text | `''` | Descripción del movimiento |
| created_by | text | `'admin'` | Quién hizo el movimiento |
| created_at | timestamptz | now() | Timestamp |

### 2.9 `profiles` — Perfiles de usuario
| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | — | ID del usuario de auth (unique) |
| display_name | text | `''` | Nombre para mostrar |

### 2.10 `expenses` — Gastos
| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | uuid | gen_random_uuid() | PK |
| date | date | — | Fecha del gasto |
| amount | integer | — | Monto |
| payment_method | text | — | Medio de pago usado |
| fund | text | — | `"EFECTIVO"` o `"MERCADOPAGO"` |
| category | text | null | Categoría del gasto |
| description | text | null | Descripción libre |
| is_pass_through | boolean | false | true = rendición (no afecta resultado operativo) |
| created_by | text | `'admin'` | Quién creó |

### 2.11 `cash_opening_balances` — Saldos iniciales de caja
| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | uuid | gen_random_uuid() | PK |
| date | date | — | Fecha del saldo |
| fund | text | — | `"EFECTIVO"` o `"MERCADOPAGO"` |
| amount | integer | — | Monto del saldo inicial |
| notes | text | null | Notas |

### 2.12 `fund_movements` — Movimientos manuales de capital
| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | uuid | gen_random_uuid() | PK |
| date | date | — | Fecha |
| fund | text | — | `"EFECTIVO"` o `"MERCADOPAGO"` |
| amount | integer | — | Monto |
| type | text | `'INGRESO'` | `"INGRESO"` o `"RETIRO"` |
| description | text | null | Descripción |
| created_by | text | `'admin'` | Quién lo creó |

### 2.13 `pos_layaways` — Señas/Apartados
| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | uuid | gen_random_uuid() | PK |
| sale_id | uuid | — | FK → pos_sales.id |
| customer_name | text | `''` | Nombre del cliente |
| customer_phone | text | `''` | Teléfono |
| total | integer | — | Total de la venta |
| paid | integer | 0 | Monto pagado hasta ahora |
| balance | integer | 0 | Saldo pendiente (`total - paid`) |
| due_date | date | null | Fecha límite |
| status | text | `'PENDING'` | `"PENDING"`, `"COMPLETED"`, `"CANCELLED"` |
| notes | text | `''` | Notas |
| completed_at | timestamptz | null | Fecha de completado |

---

## 3. Flujo de creación de venta (POS)

### 3.1 Selección en el POS

1. El vendedor elige **canal** (LOCAL/ONLINE) y **opción de cobro** (price_term)
2. El price_term determina automáticamente:
   - El precio que se usa para cada producto (`prices[channel_termCode]`)
   - El fondo destino del dinero
   - La comisión a registrar
3. Se agregan productos al carrito con el precio correspondiente

### 3.2 Venta normal (`createSale`)

```
1. VERIFICAR STOCK
   - Para cada item con track_stock=true:
     - Consultar stock_balances.qty_on_hand
     - Si qty_on_hand < qty pedida → Error "Stock insuficiente"

2. CALCULAR TOTALES
   - subtotal_local = Σ (unit_price × qty) de todos los items
   - total = subtotal_local + delivery_fee

3. INSERTAR pos_sales
   - channel, price_term (code), delivery_fee, subtotal_local, total
   - status = "COMPLETED"
   - created_by = userId del vendedor logueado

4. INSERTAR pos_sale_items (batch)
   - Un row por cada item del carrito
   - owner = "LOCAL", item_type = "PRODUCT"
   - Snapshot del nombre y variante

5. INSERTAR pos_payments (1 pago)
   - payment_method = price_term.code
   - fund = price_term.fund (o fallback)
   - amount = total
   - commission_pct = surcharge_pct del term
   - commission_amount = calculado

6. DESCONTAR STOCK (secuencial por item)
   - INSERT stock_movement type="SALE"
   - UPDATE stock_balances SET qty_on_hand = qty_on_hand - qty
```

### 3.3 Checkout modal

El modal de checkout (`CheckoutModal.tsx`) muestra:
- Subtotal productos, envío (si aplica), total
- Forma de pago (label del price_term seleccionado)
- Fondo destino
- Si es EFECTIVO: input de "monto recibido" + cálculo de vuelto
- Si tiene comisión > 0: desglose de comisión y neto
- Modo alternativo "Seña" si aplica

### 3.4 Venta con seña/apartado (`createLayawaySale`)

```
Igual que venta normal pero:
- status = "LAYAWAY" en vez de "COMPLETED"
- Se crea registro en pos_layaways con datos del cliente
- El pago registrado es solo el depósito inicial
- Se puede elegir medio de pago del depósito independientemente
- El stock se descuenta inmediatamente (reserva)
```

---

## 4. Historial de ventas y devoluciones

### 4.1 Fetch de ventas recientes (`fetchRecentSales`)

```typescript
// 1. Fetch pos_sales con status=COMPLETED, orden desc, limit 100
// 2. En paralelo: fetch items, payments y profiles
// 3. Mapear created_by → display_name via profiles
// 4. Retornar array de SaleForReturn
```

### 4.2 UI del historial (`Ventas.tsx`)

**Filtros**: búsqueda por producto, por vendedor, por medio de pago.

**Tabla**: Fecha | Vendedor | Productos | Medio de pago | Total | [Devolver]

- Click en fila → dialog de detalle
- Botón "Devolver" → modal de selección de items

### 4.3 Proceso de devolución (`processReturn`)

```typescript
// Para cada item a devolver:
// 1. INSERT stock_movement type="RETURN"
// 2. UPDATE stock_balances SET qty_on_hand += qty
```

**Nota**: La devolución solo ajusta stock. NO crea venta negativa, NO modifica la venta original, NO revierte pagos.

---

## 5. Lógica financiera

### 5.1 Resultado (`fetchResultadoRange`)

P&L por día para un rango de fechas.

```
bruto      = Σ pos_payments.amount (de ventas COMPLETED)
comisiones = Σ pos_payments.commission_amount
neto       = bruto - comisiones
cogs       = Σ (pos_sale_items.qty × products.cost_price) donde owner="LOCAL"
gastos     = Σ expenses.amount donde is_pass_through=false
ganancia   = neto - cogs - gastos
```

### 5.2 Capital (`fetchCapitalCurrent`)

Calcula el balance **actual** de cada fondo acumulando **todo el historial** (sin filtro de fechas).

```
Para cada fondo (EFECTIVO / MERCADOPAGO):
  saldo_inicial    = último cash_opening_balance
  entradas         = Σ pos_payments.amount (COMPLETED + LAYAWAY)
                   + Σ fund_movements.amount donde type="INGRESO"
  salidas          = Σ expenses.amount (todas, incluyendo rendiciones)
                   + Σ fund_movements.amount donde type="RETIRO"
  esperado         = saldo_inicial + entradas - salidas
```

**Diferencias clave con Resultado**:
- Capital incluye TODOS los gastos (incluyendo rendiciones)
- Capital incluye pagos de señas (LAYAWAY)
- Capital incluye movimientos manuales (ingresos/retiros)
- Capital NO tiene filtro de fechas, siempre muestra el estado actual

### 5.3 Detalle del día (`fetchDayDetail`)

Misma lógica que Resultado pero para un solo día. Devuelve lista de `expenses[]` para desglose.

### 5.4 Gastos (`fetchExpensesRange`)

Fetch de todos los gastos en un rango de fechas. La UI los clasifica en:
- **Operativos** (is_pass_through=false): afectan resultado
- **Rendiciones** (is_pass_through=true): solo afectan capital

---

## 6. Opciones de cobro

La tabla `price_terms` reemplaza al viejo sistema de `price_settings` + métodos de pago separados.

| Code | Label (ejemplo) | Surcharge | Fund | Installments |
|------|-----------------|-----------|------|-------------|
| EFECTIVO | Efectivo | 0% | EFECTIVO | 1 |
| DEBITO | Débito | 0% | MERCADOPAGO | 1 |
| TRANSFERENCIA | Transferencia | 0% | MERCADOPAGO | 1 |
| CREDITO_1 | Crédito 1 cuota | 10% | MERCADOPAGO | 1 |
| CREDITO_3 | Crédito 3 cuotas | 20% | MERCADOPAGO | 3 |

*Los valores son ejemplos; se configuran dinámicamente desde la UI.*

---

## 7. Canales de venta

| Canal | Descripción |
|-------|-------------|
| LOCAL | Venta presencial en local |
| ONLINE | Venta online / envío |

Los precios pueden diferir entre canales.

---

## 8. Roles y permisos

| Rol | Descripción |
|-----|-------------|
| vendedor | Puede crear ventas, ver historial |
| encargado | Todo lo anterior + gestión de productos, stock, finanzas, usuarios |

Se usa tabla `user_roles` con función `has_role(user_id, role)`.

---

## 9. Patrones técnicos importantes

### 9.1 Snapshots
Items de venta guardan `name_snapshot` y `variant_snapshot` para preservar datos históricos.

### 9.2 Montos enteros
Todos los montos en **pesos enteros** sin centavos. $1.500 = `1500`.

### 9.3 Formato de moneda (UI)
```typescript
const fmt = (n: number) => `$${n.toLocaleString("es-AR")}`;
```

### 9.4 Fechas
- Ventas: `timestamptz` (created_at)
- Gastos/saldos: `date` (solo día)
- Formato display: `dd/MM HH:mm` para listados
- Locale: `es` de date-fns

### 9.5 Stock: read-then-update (no atomic)
```typescript
const { data: bal } = await supabase
  .from("stock_balances")
  .select("qty_on_hand")
  .eq("product_id", productId)
  .single();
const newQty = (bal?.qty_on_hand ?? 0) - qty;
await supabase.from("stock_balances")
  .update({ qty_on_hand: newQty })
  .eq("product_id", productId);
```
⚠️ Race conditions posibles en alta concurrencia.

### 9.6 React Query keys
| Key | Uso |
|-----|-----|
| `["recent-sales"]` | Historial de ventas |
| `["products-with-stock"]` | Productos con stock para POS |
| `["finanzas-resultado", from, to]` | Resultado financiero |
| `["finanzas-capital"]` | Capital actual (sin filtro de fecha) |
| `["finanzas-gastos", from, to]` | Gastos por rango |
| `["finanzas-day", date]` | Detalle de un día |
| `["cfg-price-terms"]` | Opciones de cobro |

### 9.7 Parallel fetching
Se usa `Promise.all` para fetchear items, payments y profiles en paralelo.

---

## 10. Dependencias clave

| Paquete | Uso |
|---------|-----|
| `@supabase/supabase-js` | Cliente de base de datos |
| `@tanstack/react-query` | Cache y fetching |
| `date-fns` + `date-fns/locale/es` | Formateo de fechas |
| `sonner` | Toast notifications |
| `lucide-react` | Iconos |
| `shadcn/ui` | Componentes UI |
| `recharts` | Gráficos |

---

## 11. Resumen de flujo end-to-end

```
VENTA:
  POS → elegir canal + opción de cobro (price_term) → agregar productos al carrito
  → checkout → confirmar → createSale() → verificar stock → insert sale + items + payment → descontar stock
  → invalidar queries → toast éxito

HISTORIAL:
  Ventas.tsx → fetchRecentSales() → tabla con filtros
  → click fila → dialog detalle
  → botón devolver → modal selección items → processReturn() → restock

FINANZAS:
  Resultado (con filtro de fechas) → fetchResultadoRange() → bruto - comisiones = neto - cogs - gastos = ganancia
  Gastos (con filtro de fechas) → fetchExpensesRange() → desglose por categoría + rendiciones
  Capital (sin filtro, siempre actual) → fetchCapitalCurrent() → saldo + entradas - salidas = esperado por fondo
```
