# Módulo Ventas — Documentación de interfaz y funcionalidad

> Guía completa de lo que muestra y permite hacer la pantalla **Historial de Ventas** (`/ventas`).

---

## 1. Descripción general

El módulo **Ventas** es la pantalla de auditoría y consulta de todas las ventas completadas. Permite:

- Ver el historial completo de transacciones
- Filtrar por producto, vendedor, medio de pago, fecha y horario
- Ver el desglose financiero de cada venta (bruto, comisiones, neto, COGS, margen)
- Procesar devoluciones con reposición automática de stock

**Ruta**: `/ventas`  
**Archivo principal**: `src/pages/Ventas.tsx`  
**Store de datos**: `src/lib/return-store.ts`  
**Acceso**: todos los roles (`vendedor` y `encargado`)

---

## 2. Estructura de la pantalla

### 2.1 Encabezado
- Ícono de recibo + título "Historial de Ventas"
- Descripción: _"Detalle de cada venta: quién vendió, medio de pago y productos. Podés procesar devoluciones desde acá."_

### 2.2 Barra de filtros (fila 1)
| Filtro | Tipo | Descripción |
|--------|------|-------------|
| Buscar por producto | Input de texto con ícono 🔍 | Filtra ventas que contengan el texto en `name_snapshot` de algún item |
| Vendedor | Select dropdown | Lista dinámica de vendedores con ventas. Opción "Todos" por defecto |
| Medio de pago | Select dropdown | Filtra por `payment_method`: Efectivo, Transferencia, Débito, Crédito, QR, MercadoPago |

### 2.3 Barra de filtros (fila 2) — Fecha y horario
| Filtro | Tipo | Descripción |
|--------|------|-------------|
| Filtrar por día | Calendar picker (Popover) | Selecciona un día específico. Botón ✕ para limpiar |
| Desde | Input `time` | Hora mínima (HH:mm). Solo filtra dentro del día seleccionado |
| Hasta | Input `time` | Hora máxima (HH:mm). Botón ✕ para limpiar ambos |

**Lógica de filtrado**: los filtros se aplican en cascada (AND). Se procesan en el frontend con `useMemo` sobre el array de ventas cargadas.

---

## 3. Tabla de ventas

### 3.1 Columnas

| Columna | Visible | Contenido |
|---------|---------|-----------|
| Fecha | Siempre | `dd/MM HH:mm` (locale es) |
| Vendedor | Siempre | `display_name` del perfil o email como fallback |
| Productos | Siempre | Lista truncada: `"Nombre ×qty, Nombre ×qty"` |
| Medio de pago | Siempre | Badges con label del método + cuotas si > 1 |
| Total | Siempre | Monto bruto cobrado. En mobile muestra Neto y Margen debajo |
| Neto | Solo desktop (`md+`) | En verde. `bruto - comisiones` |
| Margen | Solo desktop (`md+`) | Verde si ≥ 0, rojo si < 0. `neto - cogs` |
| Devolver | Siempre | Botón con ícono ↩ |

### 3.2 Comportamiento
- **Click en fila** → abre dialog de detalle
- **Click en "Devolver"** → abre modal de devolución (sin abrir detalle)
- **Paginación**: 10 ventas por página con componente `TablePagination`

### 3.3 Responsive (mobile)
- Columnas Neto y Margen se ocultan en pantallas < `md`
- Los valores de Neto y Margen se muestran debajo del Total en la misma celda
- Código de colores mantenido: Neto en verde, Margen en verde/rojo

---

## 4. Dialog de detalle de venta

Se abre al hacer click en una fila de la tabla.

### 4.1 Contenido

**Header**: "Detalle de venta" + fecha y hora completa

**Secciones**:

1. **Vendedor**: nombre del vendedor
2. **Resumen financiero** (componente `FinancialSummary`):
   | Línea | Color | Fórmula |
   |-------|-------|---------|
   | Cobrado (Bruto) | Normal | Σ `payment.amount` |
   | Comisiones | Naranja | Σ `payment.commission_amount` |
   | **Neto (te queda)** | **Verde** | Bruto - Comisiones |
   | Costo mercadería (COGS) | Ámbar | Σ `item.cost_unit × item.qty` |
   | **Margen** | **Verde/Rojo** | Neto - COGS |

3. **Productos** (componente `ItemDetailLine` por cada item):
   - Nombre + variante + ×cantidad → line_total
   - Si tiene `cost_price`: muestra costo en ámbar y margen por línea

4. **Pagos** (componente `PaymentDetailLine` por cada pago):
   - Método + cuotas (si > 1) → monto
   - Si comisión > 0: `"Comisión: -$X"` (naranja) + `"Neto: $Y"` (verde)
   - Si comisión < 0 (descuento efectivo): `"+$X"` en verde

5. **Total** final en negrita

**Acciones**:
- Botón "Cerrar"
- Botón "Devolver" → abre modal de devolución

---

## 5. Modal de devolución

Se abre desde el botón "Devolver" (tabla o dialog de detalle).

### 5.1 Contenido
- Título: "Procesar devolución"
- Descripción: _"Seleccioná los productos a devolver. El stock se actualizará automáticamente."_
- Lista de items de la venta, cada uno con:
  - Checkbox para seleccionar
  - Nombre + variante
  - Info: `"Vendido: X — $Y c/u"`
  - Si seleccionado: input numérico para cantidad (1 a qty original)

### 5.2 Comportamiento

1. El usuario selecciona items con checkbox
2. Puede ajustar la cantidad a devolver (parcial)
3. Al confirmar:
   - Se valida que haya al menos 1 item seleccionado
   - Se llama a `processReturn(saleId, items)`
   - Para cada item con `product_id`:
     - INSERT en `stock_movements` con type `"RETURN"`
     - UPDATE `stock_balances` sumando la cantidad devuelta
   - Se invalidan queries: `["products-with-stock"]` y `["recent-sales"]`
   - Toast de éxito

### 5.3 Limitaciones importantes
- **Solo ajusta stock**: la devolución NO crea una venta negativa
- **No modifica la venta original**: el registro de venta permanece intacto
- **No revierte pagos**: no hay reversión financiera automática
- Items sin `product_id` se ignoran en la devolución

---

## 6. Carga de datos

### 6.1 Query principal
```
queryKey: ["recent-sales"]
queryFn: fetchRecentSales(100)
```

### 6.2 Lógica de `fetchRecentSales`

1. Fetch `pos_sales` con `status = "COMPLETED"`, orden descendente, limit 100
2. En paralelo (Promise.all):
   - `pos_sale_items` de esas ventas
   - `pos_payments` de esas ventas
   - `profiles` (todos los perfiles)
   - `products` (para obtener `cost_price`)
3. Si hay vendedores sin perfil → fallback a `manage-users` edge function
4. Calcula por cada venta:
   - `bruto` = Σ payments.amount
   - `comisiones` = Σ payments.commission_amount
   - `neto` = bruto - comisiones
   - `cogs` = Σ (cost_price × qty) de items con product_id
   - `margen` = neto - cogs

### 6.3 Mapa de vendedores
- Prioridad: `profiles.display_name` → `manage-users.display_name` → `manage-users.email` → UUID crudo

---

## 7. Código de colores

| Concepto | Color | Clase Tailwind |
|----------|-------|----------------|
| Neto | Verde | `text-green-600` |
| Comisiones | Naranja | `text-orange-500` |
| COGS | Ámbar | `text-amber-600` |
| Margen positivo | Verde | `text-green-600` |
| Margen negativo | Rojo | `text-red-500` |
| Descuento efectivo | Verde | `text-green-600` |

---

## 8. Labels de medios de pago

| Code (DB) | Label (UI) |
|-----------|------------|
| EFECTIVO | Efectivo |
| TRANSFERENCIA | Transferencia |
| DEBITO | Débito |
| CREDITO | Crédito |
| QR | QR |
| MERCADOPAGO | MercadoPago |

Los badges muestran el label + cantidad de cuotas si > 1 (ej: `"Crédito 3c"`).

---

## 9. Componentes internos

| Componente | Descripción |
|------------|-------------|
| `PaymentBadges` | Badges de medios de pago en la tabla |
| `FinancialSummary` | Resumen financiero en el dialog de detalle |
| `PaymentDetailLine` | Línea de pago con comisión en el dialog |
| `ItemDetailLine` | Línea de producto con costo y margen en el dialog |
| `TablePagination` | Paginación reutilizable (10 items/página) |

---

## 10. Archivos fuente

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/pages/Ventas.tsx` | UI completa del módulo |
| `src/lib/return-store.ts` | Fetch de ventas (`fetchRecentSales`) + devoluciones (`processReturn`) |
| `src/components/config/TablePagination.tsx` | Componente de paginación |
| `src/hooks/use-pagination.ts` | Hook de paginación |

---

## 11. Flujo completo del usuario

```
1. Entra a /ventas
2. Ve la tabla con las últimas 100 ventas completadas
3. Puede filtrar por: texto, vendedor, medio de pago, fecha, rango horario
4. Click en fila → ve detalle completo con desglose financiero
5. Desde detalle o tabla → click "Devolver"
6. Selecciona items y cantidades → confirma
7. Stock se actualiza automáticamente
8. La venta original no se modifica
```
