# 03 — Entities & Schema

Listado completo de entidades, campos, tipos, claves y relaciones.

---

## Módulo: Productos y Catálogo

### `products`
| Campo | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| name | text | No | — | |
| type | text | No | — | Denormalizado desde product_types |
| category | text | No | `''` | Denormalizado desde product_categories |
| variant_label | text | No | `''` | |
| sku | text | No | `''` | |
| cost_price | integer | No | 0 | Precio de costo en pesos |
| min_stock | integer | No | 0 | |
| track_stock | boolean | No | true | |
| is_active | boolean | No | true | |
| quality_rating | integer | Sí | null | 1-5 stars |
| type_id | uuid | Sí | null | FK → product_types.id |
| category_id | uuid | Sí | null | FK → product_categories.id |
| variant_set_id | uuid | Sí | null | FK → variant_sets.id |
| variant_value_id | uuid | Sí | null | FK → variant_values.id |
| created_at | timestamptz | No | `now()` | |

### `product_types`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| name | text | No | — |
| is_active | boolean | No | true |
| sort_order | integer | No | 0 |
| created_at | timestamptz | No | `now()` |

### `product_categories`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| name | text | No | — |
| type_id | uuid | Sí | null | FK → product_types.id |
| is_active | boolean | No | true |
| sort_order | integer | No | 0 |
| created_at | timestamptz | No | `now()` |

### `variant_sets`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| name | text | No | — |
| is_active | boolean | No | true |
| created_at | timestamptz | No | `now()` |

### `variant_values`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| set_id | uuid | No | — | FK → variant_sets.id |
| value | text | No | — |
| is_active | boolean | No | true |
| sort_order | integer | No | 0 |
| created_at | timestamptz | No | `now()` |

### `product_prices`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| product_id | uuid | No | — | FK → products.id |
| channel | text | No | — | LOCAL / ONLINE |
| term | text | No | — | EFECTIVO / CREDITO_1 / CREDITO_3 |
| price | numeric | No | 0 |

### `price_settings`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | integer | No | 1 | PK (singleton) |
| credit_1_pct | numeric | No | 10 |
| credit_3_pct | numeric | No | 20 |
| cash_discount_pct | numeric | No | 0 |
| debit_commission_pct | numeric | No | 0 |
| credit_commission_pct | numeric | No | 0 |
| mp_commission_pct | numeric | No | 0 |
| qr_commission_pct | numeric | No | 0 |
| transfer_commission_pct | numeric | No | 0 |
| updated_at | timestamptz | No | `now()` |

### `price_terms`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| code | text | No | — | Ej: EFECTIVO, DEBITO, etc. |
| label | text | No | — | Display name |
| surcharge_pct | numeric | No | 0 |
| default_installments | integer | Sí | null |
| fund | text | No | `'EFECTIVO'` | EFECTIVO / MERCADOPAGO |
| sort_order | integer | No | 0 |
| is_active | boolean | No | true |
| created_at | timestamptz | No | `now()` |

---

## Módulo: Stock e Inventario

### `stock_balances`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| product_id | uuid | No | — | PK, FK → products.id (one-to-one) |
| qty_on_hand | integer | No | 0 |

### `stock_movements`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| product_id | uuid | No | — | FK → products.id |
| type | text | No | — | PURCHASE / SALE / WASTE / ADJUST / RETURN |
| qty | integer | No | — | Signed (+/-) |
| reason | text | No | `''` |
| supplier_id | uuid | Sí | null | FK → suppliers.id |
| created_by | text | No | `'admin'` |
| created_at | timestamptz | No | `now()` |

### `suppliers`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| name | text | No | — |
| phone | text | Sí | `''` |
| lead_time_days | integer | Sí | null |
| created_at | timestamptz | No | `now()` |

### `inventory_counts`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| start_date | date | No | — |
| end_date | date | No | — |
| status | text | No | `'DRAFT'` | DRAFT / ADJUSTED / CLOSED |
| notes | text | Sí | null |
| created_by | text | No | `'admin'` |
| adjusted_at | timestamptz | Sí | null |
| closed_at | timestamptz | Sí | null |
| created_at | timestamptz | No | `now()` |

### `inventory_count_lines`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| count_id | uuid | No | — | FK → inventory_counts.id |
| product_id | uuid | No | — | FK → products.id |
| system_qty | integer | No | — |
| counted_qty | integer | Sí | null |
| diff_qty | integer | Sí | null |
| created_at | timestamptz | No | `now()` |

---

## Módulo: Ventas (POS)

### `pos_sales`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| channel | text | No | — | LOCAL / ONLINE |
| price_term | text | No | — |
| delivery_fee | integer | No | 0 |
| subtotal_local | integer | No | 0 |
| subtotal_restaurant | integer | No | 0 |
| total | integer | No | 0 |
| status | text | No | `'COMPLETED'` | COMPLETED / LAYAWAY / CANCELLED |
| customer_id | uuid | Sí | null | FK → customers.id |
| customer_name_snapshot | text | No | `''` |
| customer_email_snapshot | text | No | `''` |
| created_by | text | No | `'admin'` |
| created_at | timestamptz | No | `now()` |

### `pos_sale_items`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| sale_id | uuid | No | — | FK → pos_sales.id |
| product_id | uuid | Sí | null | FK → products.id |
| restaurant_item_id | uuid | Sí | null |
| item_type | text | No | — | PRODUCT / DISCOUNT |
| name_snapshot | text | No | — |
| variant_snapshot | text | No | `''` |
| qty | integer | No | — |
| unit_price | integer | No | — |
| line_total | integer | No | — |
| promotion_id | uuid | Sí | null | FK → promotions.id |
| notes | text | No | `''` |
| owner | text | No | — | LOCAL |

### `pos_payments`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| sale_id | uuid | No | — | FK → pos_sales.id |
| payment_method | text | No | — |
| fund | text | No | — | EFECTIVO / MERCADOPAGO |
| amount | integer | No | — |
| installments | integer | No | 1 |
| commission_pct | numeric | No | 0 |
| commission_amount | integer | No | 0 |

### `pos_layaways`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| sale_id | uuid | No | — | FK → pos_sales.id |
| total | integer | No | — |
| paid | integer | No | 0 |
| balance | integer | No | 0 |
| customer_name | text | No | `''` |
| customer_phone | text | No | `''` |
| due_date | date | Sí | null |
| status | text | No | `'PENDING'` | PENDING / COMPLETED / CANCELLED |
| notes | text | Sí | `''` |
| completed_at | timestamptz | Sí | null |
| created_at | timestamptz | No | `now()` |

---

## Módulo: Promociones

### `promotions`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| name | text | No | — |
| type | text | No | — | BUY_X_GET_Y / PERCENT_OFF / FIXED_PRICE |
| buy_qty | integer | Sí | null |
| get_qty | integer | Sí | null |
| percent_off | numeric | Sí | null |
| fixed_price | integer | Sí | null |
| start_date | date | Sí | null |
| end_date | date | Sí | null |
| is_active | boolean | No | true |
| sort_order | integer | No | 0 |
| created_at | timestamptz | No | `now()` |

### `promotion_products` (junction table)
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| promotion_id | uuid | No | — | PK (composite), FK → promotions.id |
| product_id | uuid | No | — | PK (composite), FK → products.id |

---

## Módulo: Finanzas

### `expenses`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| date | date | No | — |
| amount | integer | No | — |
| payment_method | text | No | — |
| fund | text | No | — |
| category | text | Sí | null |
| description | text | Sí | null |
| is_pass_through | boolean | No | false |
| source_stock_movement_id | uuid | Sí | null |
| created_by | text | No | `'admin'` |
| created_at | timestamptz | No | `now()` |

### `fund_movements`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| date | date | No | — |
| fund | text | No | — |
| type | text | No | `'INGRESO'` | INGRESO / RETIRO |
| amount | integer | No | — |
| description | text | Sí | null |
| created_by | text | No | `'admin'` |
| created_at | timestamptz | No | `now()` |

### `cash_opening_balances`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| date | date | No | — |
| fund | text | No | — |
| amount | integer | No | — |
| notes | text | Sí | null |
| created_at | timestamptz | No | `now()` |

---

## Módulo: Clientes

### `customers`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| full_name | text | No | — |
| email | text | Sí | null |
| phone | text | Sí | null |
| document | text | Sí | null |
| address | text | Sí | null |
| is_active | boolean | No | true |
| created_by | uuid | Sí | null |
| created_at | timestamptz | No | `now()` |

---

## Módulo: Usuarios y Auth

### `profiles`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| user_id | uuid | No | — | Unique, referencia a auth.users |
| display_name | text | No | `''` |
| created_at | timestamptz | No | `now()` |

### `user_roles`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| user_id | uuid | No | — | Unique(user_id, role) |
| role | app_role (enum) | No | — | vendedor / encargado |
| created_at | timestamptz | No | `now()` |

---

## Módulo: Auditoría

### `audit_log`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| table_name | text | No | — |
| record_id | text | No | — |
| action | text | No | — |
| old_data | jsonb | Sí | null |
| new_data | jsonb | Sí | null |
| user_id | uuid | Sí | null |
| created_at | timestamptz | No | `now()` |

---

## Módulo: Legacy

### `categories`
| Campo | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | No | `gen_random_uuid()` | PK |
| name | text | No | — |
| created_at | timestamptz | No | `now()` |

> Nota: esta tabla parece ser legacy (reemplazada por `product_categories`). Aún se usa en el filtro de Stock.

---

## Enums

### `app_role`
Valores: `vendedor`, `encargado`

---

## Database Functions

| Función | Tipo | Uso |
|---|---|---|
| `has_role(_user_id uuid, _role app_role)` | SECURITY DEFINER | RLS policies |
| `get_last_supplier_per_product()` | SECURITY DEFINER | Stock page — último proveedor por producto |
| `handle_new_user()` | SECURITY DEFINER, trigger | Auto-crea profile al crear usuario |
| `validate_payment_method_fund()` | trigger | Valida fund en tabla (no verificado cuál) |
