import { supabase } from "@/integrations/supabase/client";

export interface Customer {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("is_active", true)
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as Customer[];
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("is_active", true)
    .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,document.ilike.%${q}%`)
    .order("full_name")
    .limit(10);
  if (error) throw error;
  return (data ?? []) as Customer[];
}

export async function createCustomer(
  fullName: string,
  email?: string,
  document?: string,
  address?: string,
  phone?: string
): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .insert({
      full_name: fullName,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      document: document?.trim() || null,
      address: address?.trim() || null,
    })
    .select()
    .single();
  if (error) {
    // Handle unique email constraint
    if (error.code === "23505" && email) {
      const { data: existing } = await supabase
        .from("customers")
        .select("*")
        .ilike("email", email.trim())
        .single();
      if (existing) return existing as Customer;
    }
    throw error;
  }
  return data as Customer;
}

export async function updateCustomer(
  id: string,
  updates: Partial<Pick<Customer, "full_name" | "email" | "phone" | "document" | "address" | "is_active">>
) {
  const { error } = await supabase.from("customers").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteCustomer(id: string) {
  // Soft delete
  const { error } = await supabase.from("customers").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}
