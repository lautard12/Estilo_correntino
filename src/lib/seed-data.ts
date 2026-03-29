import { Product, StockBalance, StockMovement } from './types';

export const seedProducts: Product[] = [
  // JUEGOS PARRILLEROS
  { id: '1', name: 'Set Parrillero Clásico', type: 'JUEGOS_PARRILLEROS', category: 'Set Parrillero', variant_label: '5 piezas', sku: 'JPR-SET-5P', track_stock: true, min_stock: 3, is_active: true, created_at: '2024-01-01' },
  { id: '2', name: 'Set Asador Premium', type: 'JUEGOS_PARRILLEROS', category: 'Set Asador', variant_label: '7 piezas', sku: 'JPR-ASA-7P', track_stock: true, min_stock: 2, is_active: true, created_at: '2024-01-01' },
  { id: '3', name: 'Set Camping Aventura', type: 'JUEGOS_PARRILLEROS', category: 'Set Camping', variant_label: '3 piezas', sku: 'JPR-CAM-3P', track_stock: true, min_stock: 4, is_active: true, created_at: '2024-01-01' },
  // CUCHILLOS CHICOS
  { id: '4', name: 'Cuchillo de Mesa Artesanal', type: 'CUCHILLOS_CHICOS', category: 'Cuchillo de mesa', variant_label: '15cm', sku: 'CCH-MES-15', track_stock: true, min_stock: 5, is_active: true, created_at: '2024-01-01' },
  { id: '5', name: 'Cuchillo Frutero', type: 'CUCHILLOS_CHICOS', category: 'Cuchillo para frutas', variant_label: '18cm', sku: 'CCH-FRU-18', track_stock: true, min_stock: 5, is_active: true, created_at: '2024-01-01' },
  // CUCHILLOS MEDIANOS
  { id: '6', name: 'Cuchillo Cocina Tradicional', type: 'CUCHILLOS_MEDIANOS', category: 'Cuchillo de cocina', variant_label: '25cm', sku: 'CMD-COC-25', track_stock: true, min_stock: 4, is_active: true, created_at: '2024-01-01' },
  { id: '7', name: 'Cuchillo Carnicero Gaucho', type: 'CUCHILLOS_MEDIANOS', category: 'Cuchillo carnicero', variant_label: '28cm', sku: 'CMD-CAR-28', track_stock: true, min_stock: 3, is_active: true, created_at: '2024-01-01' },
  { id: '8', name: 'Cuchillo Multiuso Campo', type: 'CUCHILLOS_MEDIANOS', category: 'Cuchillo multiuso', variant_label: '22cm', sku: 'CMD-MUL-22', track_stock: true, min_stock: 5, is_active: true, created_at: '2024-01-01' },
  // CUCHILLOS ESPECIALES
  { id: '9', name: 'Cuchillo Filetero Pro', type: 'CUCHILLOS_ESPECIALES', category: 'Cuchillo filetero', variant_label: '30cm', sku: 'CES-FIL-30', track_stock: true, min_stock: 2, is_active: true, created_at: '2024-01-01' },
  { id: '10', name: 'Cuchillo Deshuesador', type: 'CUCHILLOS_ESPECIALES', category: 'Cuchillo deshuesador', variant_label: '25cm', sku: 'CES-DES-25', track_stock: true, min_stock: 3, is_active: true, created_at: '2024-01-01' },
  // FACONES Y DAGAS
  { id: '11', name: 'Facón Criollo Clásico', type: 'FACONES_Y_DAGAS', category: 'Facón criollo', variant_label: '30cm', sku: 'FAC-CRI-30', track_stock: true, min_stock: 2, is_active: true, created_at: '2024-01-01' },
  { id: '12', name: 'Daga Gaucha Ornamental', type: 'FACONES_Y_DAGAS', category: 'Daga gaucha', variant_label: '25cm', sku: 'FAC-DAG-25', track_stock: true, min_stock: 2, is_active: true, created_at: '2024-01-01' },
  // GAMA PREMIUM
  { id: '13', name: 'Cuchillo Premium Ejecutivo', type: 'GAMA_PREMIUM', category: 'Premium Ejecutivo', variant_label: '30cm', sku: 'GPR-EJE-30', track_stock: true, min_stock: 1, is_active: true, created_at: '2024-01-01' },
  { id: '14', name: 'Edición Limitada Damasco', type: 'GAMA_PREMIUM', category: 'Edición Limitada', variant_label: '35cm', sku: 'GPR-DAM-35', track_stock: true, min_stock: 1, is_active: true, created_at: '2024-01-01' },
  // ACCESORIOS
  { id: '15', name: 'Funda de Cuero', type: 'ACCESORIOS', category: 'Fundas', variant_label: 'Mediano', sku: 'ACC-FUN-M', track_stock: true, min_stock: 5, is_active: true, created_at: '2024-01-01' },
];

export const seedBalances: StockBalance[] = [
  { product_id: '1', qty_on_hand: 8 },
  { product_id: '2', qty_on_hand: 4 },
  { product_id: '3', qty_on_hand: 6 },
  { product_id: '4', qty_on_hand: 12 },
  { product_id: '5', qty_on_hand: 10 },
  { product_id: '6', qty_on_hand: 7 },
  { product_id: '7', qty_on_hand: 3 },
  { product_id: '8', qty_on_hand: 9 },
  { product_id: '9', qty_on_hand: 2 },
  { product_id: '10', qty_on_hand: 5 },
  { product_id: '11', qty_on_hand: 3 },
  { product_id: '12', qty_on_hand: 2 },
  { product_id: '13', qty_on_hand: 1 },
  { product_id: '14', qty_on_hand: 1 },
  { product_id: '15', qty_on_hand: 15 },
];

export const seedMovements: StockMovement[] = [
  { id: 'm1', product_id: '1', type: 'PURCHASE', qty: 8, reason: 'Compra inicial', created_at: '2024-01-15T10:00:00', created_by: 'admin' },
  { id: 'm2', product_id: '9', type: 'PURCHASE', qty: 5, reason: 'Reposición fileteros', created_at: '2024-01-16T14:30:00', created_by: 'admin' },
  { id: 'm3', product_id: '13', type: 'SALE', qty: 1, reason: 'Venta mostrador', created_at: '2024-01-16T15:00:00', created_by: 'admin' },
  { id: 'm4', product_id: '11', type: 'PURCHASE', qty: 3, reason: 'Reposición facones', created_at: '2024-01-17T09:00:00', created_by: 'admin' },
  { id: 'm5', product_id: '7', type: 'ADJUST', qty: -1, reason: 'Ajuste de inventario', created_at: '2024-01-17T11:00:00', created_by: 'admin' },
];
