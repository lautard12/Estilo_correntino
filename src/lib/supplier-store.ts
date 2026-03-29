import { supabase } from "@/integrations/supabase/client";

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  lead_time_days: number | null;
  created_at: string;
}

export async function fetchSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Supplier[];
}

export async function createSupplier(name: string, phone: string = "", leadTimeDays?: number | null): Promise<Supplier> {
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ name, phone, lead_time_days: leadTimeDays ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as Supplier;
}

export async function updateSupplier(id: string, updates: { name?: string; phone?: string; lead_time_days?: number | null }) {
  const { error } = await supabase
    .from("suppliers")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSupplier(id: string) {
  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Fetch purchase history for a product (with supplier info)
export async function fetchProductPurchaseHistory(productId: string) {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*, suppliers(name, phone)")
    .eq("product_id", productId)
    .eq("type", "PURCHASE")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    ...m,
    supplier: m.suppliers ?? null,
    suppliers: undefined,
  }));
}
