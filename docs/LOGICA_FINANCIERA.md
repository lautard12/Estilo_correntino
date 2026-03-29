# Lógica Financiera y de Precios — Documentación Completa

## Índice

1. [Estructura de precios](#1-estructura-de-precios)
2. [Opciones de cobro (price_terms)](#2-opciones-de-cobro-price_terms)
3. [Fondos de dinero](#3-fondos-de-dinero)
4. [Flujo de una venta](#4-flujo-de-una-venta)
5. [Señas (Layaways)](#5-señas-layaways)
6. [Devoluciones](#6-devoluciones)
7. [Gastos](#7-gastos)
8. [Módulo de Finanzas](#8-módulo-de-finanzas)
9. [Cierre de caja](#9-cierre-de-caja)
10. [Reportes](#10-reportes)
11. [Esquema de base de datos](#11-esquema-de-base-de-datos)

---

## 1. Estructura de precios

### Precios por producto (tabla `product_prices`)

Cada producto tiene precios almacenados como combinación de **canal** y **término (plazo)**:

- **Canal** (2): `LOCAL` (venta en local) | `ONLINE` (delivery/web)
- **Término**: códigos dinámicos definidos en la tabla `price_terms` (ej: `EFECTIVO`, `DEBITO`, `CREDITO_1`, `CREDITO_3`)

**El usuario solo carga 2 precios base** (LOCAL BASE y ONLINE BASE, donde BASE es el término con `surcharge_pct = 0`). Los demás precios se calculan automáticamente aplicando el recargo de cada término:

```
Precio término X = Precio BASE × (1 + surcharge_pct / 100)   → redondeado a entero
```

Ejemplo con BASE = $10.000, término "Crédito 1 cuota" con surcharge_pct = 10%:
- BASE: $10.000
- CREDITO_1: $11.000

### Recálculo masivo

Existe una función `recalculateAllPrices()` que toma todos los precios BASE de todos los productos y recalcula los precios de cada término activo con recargo > 0.

### Precio de costo

Cada producto tiene un `cost_price` (precio de costo en entero). Se usa para calcular **COGS**, **márgenes de ganancia** y **rentabilidad** en reportes y en el módulo de Resultado.

---

## 2. Opciones de cobro (price_terms)

### Arquitectura unificada

El sistema usa una tabla `price_terms` que define **todas las opciones de cobro** disponibles. Cada opción combina en un solo registro lo que antes eran conceptos separados (método de pago, plazo, recargo, comisión).

### Tabla `price_terms`

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `code` | Código único | `EFECTIVO`, `DEBITO`, `CREDITO_1`, `CREDITO_3` |
| `label` | Nombre visible | "Efectivo", "Débito", "Crédito 1 cuota" |
| `surcharge_pct` | Recargo al cliente (%) | 0, 10, 20 |
| `default_installments` | Cuotas por defecto | 1, 3, null |
| `fund` | Fondo destino del dinero | `EFECTIVO` o `MERCADOPAGO` |
| `sort_order` | Orden de visualización | 1, 2, 3... |
| `is_active` | Si está habilitada | true/false |

### Lógica clave

**El recargo al cliente iguala la comisión de la plataforma.** Esto asegura que el ingreso neto percibido por el negocio coincida exactamente con el precio base del producto. El `surcharge_pct` cumple doble función:

1. Define cuánto se le recarga al cliente sobre el precio base
2. Se usa como `commission_pct` al registrar el pago (la comisión que retiene el procesador)

```
Precio final = Precio base × (1 + surcharge_pct / 100)
Comisión = Precio final × surcharge_pct / (100 + surcharge_pct)
Neto = Precio final - Comisión ≈ Precio base
```

### Fondo destino

Cada término define a qué fondo va el dinero:
- `fund = "EFECTIVO"` → el dinero va al fondo Efectivo (caja física)
- `fund = "MERCADOPAGO"` → el dinero va al fondo MercadoPago (digital)

---

## 3. Fondos de dinero

El sistema maneja **2 fondos** donde se acumula el dinero:

| Fondo | Código | Descripción |
|-------|--------|-------------|
| Efectivo | `EFECTIVO` | Caja física |
| MercadoPago | `MERCADOPAGO` | Cuenta digital |

Cada fondo tiene:
- **Saldo inicial** (tabla `cash_opening_balances`): se carga manualmente para establecer el punto de partida
- **Entradas**: cobros de ventas + ingresos manuales (fund_movements tipo INGRESO)
- **Salidas**: gastos registrados + retiros manuales (fund_movements tipo RETIRO)

```
Saldo esperado = Saldo inicial + Entradas - Salidas
```

### Movimientos manuales de fondos (tabla `fund_movements`)

Permiten registrar inyecciones de capital o extracciones de efectivo que no son ventas ni gastos:

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| `INGRESO` | Inyección de capital | Dueño pone plata en caja |
| `RETIRO` | Extracción de capital | Dueño retira para uso personal |

---

## 4. Flujo de una venta

### Paso a paso (simplificado)

1. **Selección de productos**: el vendedor agrega productos al carrito
2. **Selección de opción de cobro**: se elige UN término (ej: "Crédito 1 cuota") que automáticamente define:
   - El precio final (con recargo si aplica)
   - El fondo destino del dinero
   - La comisión que se restará
3. **Checkout**: se abre el modal con el resumen
4. **Confirmación**: se registra con un único pago

### Registros creados por venta

| Tabla | Qué se guarda |
|-------|--------------|
| `pos_sales` | Cabecera: canal, price_term, totales, vendedor, status=COMPLETED |
| `pos_sale_items` | Líneas: producto, cantidad, precio unitario, total línea, owner=LOCAL |
| `pos_payments` | Pago: método (code del term), monto, cuotas, comisión, fondo |
| `stock_movements` | Movimiento tipo SALE por cada producto con stock |
| `stock_balances` | Se actualiza qty_on_hand restando la cantidad vendida |

### Cálculo de totales

```
subtotal_local = Σ (unit_price × qty) de todos los items
delivery_fee = tarifa de envío (solo para canal ONLINE)
total = subtotal_local + delivery_fee
```

### Checkout simplificado

El modal de checkout:
- Muestra subtotal, envío y total
- Muestra la forma de pago ya seleccionada (el price_term elegido en el POS)
- Si es efectivo: permite ingresar "monto recibido" y calcula vuelto
- Si tiene comisión: muestra el desglose de comisión y neto
- Un solo botón "Confirmar venta"

---

## 5. Señas (Layaways)

Una seña es una **venta con pago parcial**:

1. Se registra con `status = "LAYAWAY"`
2. Se crea registro en `pos_layaways` con datos del cliente y montos
3. El stock se reserva inmediatamente
4. El depósito se registra como pago en `pos_payments`
5. En el checkout, se puede elegir el medio de pago para el depósito independientemente del term de la venta

### Estado en Capital

Las ventas LAYAWAY **sí cuentan como entradas de capital** (el dinero del depósito entró al fondo).

---

## 6. Devoluciones

Solo ajuste de stock, sin reversión financiera:
1. Se crea movimiento de stock tipo `RETURN`
2. Se actualiza `stock_balances`
3. **NO se modifica** la venta original ni los pagos

---

## 7. Gastos

### Registro

Cada gasto tiene:
- `date`, `amount`, `payment_method`, `fund` (calculado automáticamente)
- `category`: Insumos | Servicios | Alquiler | Sueldos | Impuestos | Otros | Rendición restaurante
- `description`: texto libre
- `is_pass_through`: booleano especial

### Gastos operativos vs Rendiciones

| Tipo | is_pass_through | Afecta Resultado | Afecta Capital |
|------|----------------|-----------------|----------------|
| **Operativo** (Insumos, Sueldos, etc.) | `false` | ✅ Resta de ganancia | ✅ Salida de fondo |
| **Rendición** (Rendición restaurante) | `true` | ❌ No afecta | ✅ Salida de fondo |

### Pestaña Gastos en Finanzas

La pestaña de Gastos tiene sus **propios filtros de fecha** (independientes de Resultado) y muestra:
- Cards resumen: gastos operativos, rendiciones, total egresos
- Desglose por categoría con barras de porcentaje
- Desglose por medio de pago
- Filtro por categoría específica o rendiciones
- Lista individual de cada gasto con opción de eliminar

---

## 8. Módulo de Finanzas

### Estructura de pestañas

| Pestaña | Filtros de fecha | Descripción |
|---------|-----------------|-------------|
| **Resultado** | ✅ Propios (Hoy / 7 días / Mes / Custom) | P&L operativo por día |
| **Gastos** | ✅ Propios (mismos presets) | Detalle de egresos |
| **Capital** | ❌ Sin filtros (siempre actual) | Saldos reales de fondos |

### Pestaña "Resultado" (P&L operativo)

Muestra por día el flujo contable completo:

```
Facturado (Bruto) = Σ pos_payments.amount de ventas COMPLETED
- Comisiones (plataforma) = Σ pos_payments.commission_amount
= Neto (lo que queda)
- COGS (costo mercadería) = Σ (qty × cost_price) de items LOCAL
= Margen bruto
- Gastos operativos = Σ expenses.amount donde is_pass_through = false
= Ganancia neta
```

Cards de resumen: Facturado, Comisiones, Neto, Margen bruto, Ganancia neta.

Tabla diaria con click para ver detalle del día (tickets, desglose de gastos).

### Pestaña "Capital" (Saldos actuales en tiempo real)

Muestra el estado **actual** de cada fondo acumulando **todo el historial** (sin filtro de fechas):

```
Para cada fondo (EFECTIVO / MERCADOPAGO):
  Saldo inicial = último cash_opening_balance registrado
  + Entradas = Σ pos_payments.amount (COMPLETED + LAYAWAY) + Σ fund_movements INGRESO
  - Salidas = Σ expenses.amount + Σ fund_movements RETIRO
  = Saldo esperado
```

Funciones disponibles:
- **Cargar saldo inicial**: establecer el punto de partida de un fondo
- **Registrar movimiento**: ingresos o retiros manuales de capital
- Lista de movimientos manuales con opción de eliminar

---

## 9. Cierre de caja

Permite hacer cierres diarios o semanales. Muestra:
- Total cobrado, ventas, pagos por método y por fondo
- Detalle de productos vendidos

---

## 10. Reportes

- Productos más vendidos (ranking por revenue)
- Ventas por día (gráfico)
- Ventas por método de pago (distribución)
- Margen por categoría: `Revenue - (cost_price × qty)`

---

## 11. Esquema de base de datos

### Tablas principales

#### `price_terms` (opciones de cobro)
```
id: uuid
code: text (unique)          -- ej: EFECTIVO, DEBITO, CREDITO_1
label: text                  -- ej: "Efectivo", "Crédito 1 cuota"
surcharge_pct: numeric       -- recargo/comisión (%)
default_installments: integer -- cuotas por defecto (nullable)
fund: text                   -- EFECTIVO | MERCADOPAGO
sort_order: integer
is_active: boolean
created_at: timestamptz
```

#### `product_prices`
```
id: uuid
product_id: uuid → products
channel: text (LOCAL | ONLINE)
term: text                   -- code del price_term (ej: EFECTIVO, CREDITO_1)
price: numeric (entero, en pesos)
```

#### `products`
```
id: uuid
name: text
type: text
category: text
variant_label: text
sku: text
cost_price: integer
track_stock: boolean
min_stock: integer
is_active: boolean
type_id: uuid → product_types (nullable)
category_id: uuid → product_categories (nullable)
variant_set_id: uuid → variant_sets (nullable)
variant_value_id: uuid → variant_values (nullable)
```

#### `pos_sales`
```
id: uuid
channel: text (LOCAL | ONLINE)
price_term: text             -- code del price_term usado
subtotal_local: integer
subtotal_restaurant: integer -- legacy, siempre 0
delivery_fee: integer
total: integer
status: text (COMPLETED | LAYAWAY | RETURNED)
created_by: text
created_at: timestamptz
```

#### `pos_sale_items`
```
id: uuid
sale_id: uuid → pos_sales
product_id: uuid → products (nullable)
name_snapshot: text
variant_snapshot: text
qty: integer
unit_price: integer
line_total: integer
owner: text (LOCAL)
item_type: text (PRODUCT)
notes: text
```

#### `pos_payments`
```
id: uuid
sale_id: uuid → pos_sales
payment_method: text         -- code del price_term
fund: text                   -- EFECTIVO | MERCADOPAGO
amount: integer
installments: integer
commission_pct: numeric
commission_amount: integer
```

#### `expenses`
```
id: uuid
date: date
amount: integer
payment_method: text
fund: text (EFECTIVO | MERCADOPAGO)
category: text
description: text
is_pass_through: boolean
created_by: text
created_at: timestamptz
```

#### `cash_opening_balances`
```
id: uuid
date: date
fund: text (EFECTIVO | MERCADOPAGO)
amount: integer
notes: text
created_at: timestamptz
```

#### `fund_movements`
```
id: uuid
date: date
fund: text (EFECTIVO | MERCADOPAGO)
amount: integer
type: text (INGRESO | RETIRO)
description: text
created_by: text
created_at: timestamptz
```

#### `pos_layaways`
```
id: uuid
sale_id: uuid → pos_sales
customer_name: text
customer_phone: text
total: integer
paid: integer
balance: integer
due_date: date
notes: text
status: text (PENDING | COMPLETED)
completed_at: timestamptz
created_at: timestamptz
```

#### `stock_balances`
```
product_id: uuid → products (PK, unique)
qty_on_hand: integer
```

#### `stock_movements`
```
id: uuid
product_id: uuid → products
type: text (SALE | RETURN | ADJUSTMENT | PURCHASE)
qty: integer
reason: text
created_by: text
created_at: timestamptz
```

---

## Resumen de fórmulas clave

| Concepto | Fórmula |
|----------|---------|
| Precio con recargo | `BASE × (1 + surcharge_pct / 100)` |
| Comisión de un pago | `amount × surcharge_pct / (100 + surcharge_pct)` |
| Neto de un pago | `amount - commission_amount ≈ precio base` |
| COGS | `Σ (cost_price × qty)` de items LOCAL |
| Margen bruto | `Neto - COGS` |
| Ganancia neta | `Margen bruto - Gastos operativos` |
| Capital esperado | `saldo_inicial + entradas + ingresos_manuales - gastos - retiros_manuales` |
| Fondo de un pago | definido por `price_terms.fund` |
