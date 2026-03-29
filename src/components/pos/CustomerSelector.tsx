import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { searchCustomers, createCustomer, type Customer } from "@/lib/customer-store";
import { toast } from "sonner";

interface Props {
  selected: Customer | null;
  onSelect: (c: Customer | null) => void;
}

export function CustomerSelector({ selected, onSelect }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["customer-search", query],
    queryFn: () => searchCustomers(query),
    enabled: searchOpen && query.length >= 2,
  });

  const handleSelect = (c: Customer) => {
    onSelect(c);
    setSearchOpen(false);
    setQuery("");
  };

  const validatePhone = (value: string) => {
    if (!value.trim()) return ""; // optional
    const cleaned = value.replace(/[\s\-()]/g, "");
    if (!/^\+?\d{7,15}$/.test(cleaned)) return "Número inválido (7-15 dígitos)";
    return "";
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const pErr = validatePhone(newPhone);
    if (pErr) { setPhoneError(pErr); return; }
    setSaving(true);
    try {
      const c = await createCustomer(newName, undefined, undefined, undefined, newPhone || undefined);
      onSelect(c);
      setNewOpen(false);
      setNewName(""); setNewPhone(""); setPhoneError("");
      toast.success("Cliente creado");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (selected) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
        <User className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{selected.full_name}</span>
          {selected.phone && (
            <span className="text-xs text-muted-foreground ml-2">{selected.phone}</span>
          )}
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onSelect(null)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setSearchOpen(true)}>
          <Search className="h-3 w-3 mr-1" /> Buscar cliente
        </Button>
        <Button variant="outline" size="sm" onClick={() => setNewOpen(true)}>
          <UserPlus className="h-3 w-3 mr-1" /> Nuevo
        </Button>
      </div>

      {/* Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buscar cliente</DialogTitle>
            <DialogDescription>Buscá por nombre, email o documento.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Nombre, email o DNI..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="max-h-60 overflow-y-auto space-y-1">
            {isFetching && <p className="text-sm text-muted-foreground p-2">Buscando...</p>}
            {!isFetching && query.length >= 2 && results.length === 0 && (
              <p className="text-sm text-muted-foreground p-2 text-center">No se encontraron clientes</p>
            )}
            {results.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                onClick={() => handleSelect(c)}
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{c.full_name}</div>
                  {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSearchOpen(false)}>Cancelar</Button>
            <Button variant="outline" onClick={() => { setSearchOpen(false); setNewOpen(true); }}>
              <UserPlus className="h-3 w-3 mr-1" /> Crear nuevo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick-create Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
            <DialogDescription>Alta rápida desde caja.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre y apellido *</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus /></div>
            <div>
              <Label>Teléfono</Label>
              <Input
                type="tel"
                placeholder="Ej: 3794123456"
                value={newPhone}
                onChange={(e) => { setNewPhone(e.target.value); setPhoneError(""); }}
              />
              {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || saving}>
              {saving ? "Creando..." : "Crear y seleccionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
