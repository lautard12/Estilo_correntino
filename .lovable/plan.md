

## Plan: Restaurar botón de configuración rápida en Productos

El botón de ajustes (engranaje) que tenías antes en la página de Productos se perdió cuando se implementó el módulo de Configuración. Lo vamos a restaurar, pero adaptado a la nueva arquitectura (usa `price_terms` en vez de `price_settings`).

### Cambios

1. **Refactorizar `src/components/product/CreditSettings.tsx`**
   - En vez de leer/escribir `price_settings`, leer los `price_terms` activos que tengan `surcharge_pct > 0` (CREDITO_1, CREDITO_3, etc.)
   - Mostrar cada término con su label y un input para editar `surcharge_pct`
   - Guardar con `updatePriceTerm()` del config-store
   - Mantener botón "Recalcular todos los precios" (adaptar a nueva lógica)
   - Misma estética que la screenshot: dialog compacto, inputs de porcentaje, dos botones

2. **Modificar `src/pages/Products.tsx`**
   - Importar `CreditSettings` y agregar el state `showCreditSettings`
   - Agregar botón con icono de engranaje/Settings en el header (al lado de "Nuevo producto")
   - Al clickear, abre el dialog de CreditSettings

### Detalle técnico
- `CreditSettings` usará `fetchPriceTerms()` y `updatePriceTerm()` del `config-store.ts`
- "Recalcular todos los precios" recalculará los `product_prices` derivados usando los surcharges actualizados de `price_terms`
- No se permite agregar/eliminar términos desde este dialog, solo editar valores

