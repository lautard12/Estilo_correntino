import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Plus, Search, Pencil, Trash2, BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer, type Customer } from "@/lib/customer-store";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/config/TablePagination";
import ClientesStats from "@/components/clientes/ClientesStats";

export default function Clientes() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [showNew, setShowNew] = useState(false);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formDocument, setFormDocument] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: fetchCustomers,
  });

  const filtered = search
    ? customers.filter((c) => {
        const s = search.toLowerCase();
        return c.full_name.toLowerCase().includes(s) ||
          (c.email?.toLowerCase().includes(s)) ||
          (c.document?.toLowerCase().includes(s));
      })
    : customers;

  const { page, totalPages, paged, setPage, total } = usePagination(filtered, 15);

  const openNew = () => {
    setFormName(""); setFormEmail(""); setFormPhone(""); setFormDocument(""); setFormAddress("");
    setShowNew(true);
  };

  const [formPhone, setFormPhone] = useState("");

  const openEdit = (c: Customer) => {
    setFormName(c.full_name);
    setFormEmail(c.email ?? "");
    setFormPhone(c.phone ?? "");
    setFormDocument(c.document ?? "");
    setFormAddress(c.address ?? "");
    setEditCustomer(c);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editCustomer) {
        await updateCustomer(editCustomer.id, {
          full_name: formName, email: formEmail || null,
          phone: formPhone || null,
          document: formDocument || null, address: formAddress || null,
        });
        toast.success("Cliente actualizado");
        setEditCustomer(null);
      } else {
        await createCustomer(formName, formEmail, formDocument, formAddress, formPhone);
        toast.success("Cliente creado");
        setShowNew(false);
      }
      qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    if (!confirm(`¿Dar de baja a ${c.full_name}?`)) return;
    try {
      await deleteCustomer(c.id);
      toast.success("Cliente dado de baja");
      qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const formDialog = (showNew || !!editCustomer) && (
    <Dialog open onOpenChange={() => { setShowNew(false); setEditCustomer(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editCustomer ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          <DialogDescription>Completá los datos del cliente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Nombre y apellido *</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} autoFocus /></div>
          <div><Label>Teléfono</Label><Input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="Ej: 3794123456" /></div>
          <div><Label>Email</Label><Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} /></div>
          <div><Label>DNI / CUIT</Label><Input value={formDocument} onChange={(e) => setFormDocument(e.target.value)} /></div>
          <div><Label>Dirección</Label><Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setShowNew(false); setEditCustomer(null); }}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!formName.trim() || saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Clientes</h1>
      </div>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista"><Users className="h-4 w-4 mr-1" />Lista</TabsTrigger>
          <TabsTrigger value="stats"><BarChart3 className="h-4 w-4 mr-1" />Estadísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
              </div>
              <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nuevo cliente</Button>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead className="hidden md:table-cell">DNI/CUIT</TableHead>
                      <TableHead className="hidden lg:table-cell">Dirección</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.full_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.phone ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden md:table-cell">{c.email ?? "—"}</TableCell>
                        <TableCell className="text-sm hidden md:table-cell">{c.document ?? "—"}</TableCell>
                        <TableCell className="text-sm hidden lg:table-cell">{c.address ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(c)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paged.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay clientes</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
                <TablePagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="stats">
          <ClientesStats />
        </TabsContent>
      </Tabs>

      {formDialog}
    </div>
  );
}
