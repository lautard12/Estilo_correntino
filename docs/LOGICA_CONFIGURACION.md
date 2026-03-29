# Lógica de Configuración — Documentación Completa

## Índice

1. [Acceso y permisos](#1-acceso-y-permisos)
2. [Pestaña Catálogo](#2-pestaña-catálogo)
3. [Pestaña Precios y Cobros](#3-pestaña-precios-y-cobros)
4. [Pestaña Accesos](#4-pestaña-accesos)
5. [Esquema de base de datos](#5-esquema-de-base-de-datos)
6. [Código fuente](#6-código-fuente)

---

## 1. Acceso y permisos

La sección de Configuración (`/configuracion`) es **exclusiva para usuarios con rol `encargado`**. Los usuarios con rol `vendedor` ven un mensaje de "sin permisos".

- La verificación se realiza en `src/pages/Configuracion.tsx` usando el hook `useAuth()` → `isEncargado`.
- Las tablas de configuración tienen **RLS** que permite lectura a usuarios autenticados, pero solo los `encargado` pueden crear, editar o desactivar registros.

---

## 2. Pestaña Catálogo

Gestiona la estructura jerárquica del catálogo de productos. Se divide en tres secciones:

### 2.1 Tipos de producto (`product_types`)

Clasificación de primer nivel (ej: "Juegos Parrilleros", "Cuchillos Chicos", "Accesorios").

| Campo       | Tipo    | Descripción                          |
|-------------|---------|--------------------------------------|
| `id`        | UUID    | Identificador único                  |
| `name`      | text    | Nombre del tipo                      |
| `is_active` | boolean | Si está habilitado (default: `true`) |
| `sort_order`| integer | Orden de visualización               |

**Operaciones:**
- **Crear**: Modal con campo nombre. Se inserta con `sort_order = 0` y `is_active = true`.
- **Editar**: Modal con nombre pre-cargado.
- **Activar/Desactivar**: Switch inline en la tabla. Los tipos desactivados aparecen con opacidad reducida.
- **Paginación**: 5 registros por página.

### 2.2 Categorías (`product_categories`)

Clasificación de segundo nivel, opcionalmente vinculada a un Tipo (ej: "14cm", "Hueso", "Premium").

| Campo       | Tipo      | Descripción                                  |
|-------------|-----------|----------------------------------------------|
| `id`        | UUID      | Identificador único                          |
| `name`      | text      | Nombre de la categoría                       |
| `type_id`   | UUID/null | FK a `product_types` (opcional)              |
| `is_active` | boolean   | Si está habilitada                           |
| `sort_order`| integer   | Orden de visualización                       |

**Operaciones:**
- **Crear**: Modal con nombre + selector de tipo (opcional, valor "Sin tipo" para `null`).
- **Editar**: Modal con datos pre-cargados.
- **Filtrar por tipo**: Selector en el header de la card para filtrar categorías por tipo padre.
- **Activar/Desactivar**: Switch inline.
- **Paginación**: 5 registros por página.

### 2.3 Sets de variantes (`variant_sets` + `variant_values`)

Definen atributos configurables para los productos (ej: set "Talle" con valores "S", "M", "L", "XL").

**Tabla `variant_sets`:**

| Campo       | Tipo    | Descripción            |
|-------------|---------|------------------------|
| `id`        | UUID    | Identificador único    |
| `name`      | text    | Nombre del set         |
| `is_active` | boolean | Si está habilitado     |

**Tabla `variant_values`:**

| Campo       | Tipo    | Descripción                  |
|-------------|---------|------------------------------|
| `id`        | UUID    | Identificador único          |
| `set_id`    | UUID    | FK a `variant_sets`          |
| `value`     | text    | Valor de la variante         |
| `is_active` | boolean | Si está habilitado           |
| `sort_order`| integer | Orden de visualización       |

**Flujo de uso:**
1. Se muestran los sets como badges clicables.
2. Al seleccionar un set, se despliega la tabla de valores de ese set.
3. Se pueden agregar, editar y desactivar valores individuales.
4. Al crear un set nuevo, se selecciona automáticamente para agregar valores.
5. **Paginación**: 5 valores por página.

---

## 3. Pestaña Precios y Cobros

Gestiona las **opciones de cobro** del sistema (tabla `price_terms`). Cada opción define cómo se cobra al cliente y a dónde va el dinero.

### 3.1 Opciones de cobro (`price_terms`)

| Campo                  | Tipo      | Descripción                                           |
|------------------------|-----------|-------------------------------------------------------|
| `id`                   | UUID      | Identificador único                                   |
| `code`                 | text      | Código interno (ej: `EFECTIVO`, `CREDITO_3`). Uppercase, sin espacios. |
| `label`                | text      | Etiqueta visible (ej: "Crédito 3 cuotas")             |
| `surcharge_pct`        | numeric   | Porcentaje de recargo al cliente (rango: -50% a 200%) |
| `default_installments` | int/null  | Cuotas por defecto (null si no aplica)                 |
| `fund`                 | text      | Fondo de destino: `EFECTIVO` o `MERCADOPAGO`           |
| `sort_order`           | integer   | Orden de visualización                                 |
| `is_active`            | boolean   | Si está habilitada                                     |

**Lógica clave:**
- El `surcharge_pct` cumple doble función: es el recargo que se cobra al cliente **y** la comisión del procesador. Esto asegura que el ingreso neto del negocio sea siempre igual al precio base.
- El `fund` determina a qué caja se acredita el pago (impacta en el módulo de Finanzas/Capital).
- El `code` se normaliza automáticamente a UPPERCASE y se reemplazan espacios por `_`.

**Operaciones:**
- **Crear**: Modal con todos los campos. El `sort_order` se inicializa al total de opciones existentes.
- **Editar**: Modal con datos pre-cargados.
- **Activar/Desactivar**: Switch inline.
- **Paginación**: 10 registros por página.

### 3.2 Relación con precios de productos

Los precios se almacenan en `product_prices` como combinación de **canal** (`LOCAL`/`ONLINE`) y **term** (código de la opción de cobro). Solo se cargan 2 precios base (LOCAL y ONLINE con term base), y los demás se calculan aplicando el `surcharge_pct` de cada term activo.

Desde la página de Productos hay un acceso rápido (⚙️) para editar los porcentajes y ejecutar una **recalculación masiva** que actualiza todos los precios derivados del catálogo.

---

## 4. Pestaña Accesos

Muestra información de solo lectura sobre los roles del sistema:

| Rol          | Permisos                                                        |
|--------------|-----------------------------------------------------------------|
| `encargado`  | Acceso total: Finanzas, Stock, Ventas, Precios, Usuarios, Configuración |
| `vendedor`   | Acceso restringido: solo Caja (POS) y Señas                     |

La gestión de usuarios y asignación de roles se realiza desde la sección **Usuarios** (`/usuarios`), no desde Configuración.

---

## 5. Esquema de base de datos

### Tablas involucradas

```
product_types        →  Tipos de producto (1er nivel)
product_categories   →  Categorías (2do nivel, FK a product_types)
variant_sets         →  Sets de variantes (ej: "Talle")
variant_values       →  Valores por set (FK a variant_sets)
price_terms          →  Opciones de cobro
price_settings       →  Configuración global de porcentajes (legacy, id=1)
```

### Políticas RLS

| Tabla                | SELECT              | INSERT/UPDATE/DELETE  |
|----------------------|---------------------|-----------------------|
| `product_types`      | Autenticado         | Solo `encargado`      |
| `product_categories` | Autenticado         | Solo `encargado`      |
| `variant_sets`       | Autenticado         | Solo `encargado`      |
| `variant_values`     | Autenticado         | Solo `encargado`      |
| `price_terms`        | Autenticado         | Solo `encargado`      |

Esto garantiza que los vendedores pueden **leer** el catálogo y opciones de cobro (necesario para el POS), pero no modificarlos.

---

## 6. Código fuente

### Archivos principales

| Archivo                              | Responsabilidad                                |
|--------------------------------------|------------------------------------------------|
| `src/pages/Configuracion.tsx`        | Página principal con tabs y control de acceso  |
| `src/components/config/CatalogoTab.tsx` | CRUD de Tipos, Categorías y Variantes       |
| `src/components/config/PreciosTab.tsx`  | CRUD de Opciones de cobro (price_terms)      |
| `src/components/config/AccesosTab.tsx`  | Vista informativa de roles                   |
| `src/lib/config-store.ts`           | Funciones de acceso a datos (fetch/create/update) |

### Queries React Query

| Query Key                          | Función              | Descripción                    |
|------------------------------------|----------------------|--------------------------------|
| `cfg-types`                        | `fetchTypes()`       | Lista de tipos de producto     |
| `cfg-categories`                   | `fetchCategories()`  | Lista de categorías            |
| `cfg-variant-sets`                 | `fetchVariantSets()` | Lista de sets de variantes     |
| `cfg-variant-values, {setId}`      | `fetchVariantValues(setId)` | Valores de un set       |
| `cfg-price-terms`                  | `fetchPriceTerms()`  | Lista de opciones de cobro     |

Todas las mutaciones invalidan su query key correspondiente para refrescar la UI automáticamente.
