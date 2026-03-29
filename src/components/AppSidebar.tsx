import { Package, Box, ShoppingBag, ShoppingCart, ClipboardCheck, Wallet, BookmarkCheck, Receipt, BarChart3, Users, LogOut, UserCircle, Settings, Contact } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "@/lib/auth-store";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const menuGroups = [
  {
    label: "Punto de Venta",
    items: [
      { title: "Caja", url: "/caja", icon: ShoppingCart, roles: ["vendedor", "encargado"] },
      { title: "Señas", url: "/senas", icon: BookmarkCheck, roles: ["vendedor", "encargado"] },
      { title: "Ventas", url: "/ventas", icon: Receipt, roles: ["encargado"] },
      { title: "Clientes", url: "/clientes", icon: Contact, roles: ["encargado"] },
    ],
  },
  {
    label: "Inventario",
    items: [
      { title: "Stock", url: "/stock", icon: Package, roles: ["encargado"] },
      { title: "Productos", url: "/products", icon: Box, roles: ["encargado"] },
      { title: "Compras", url: "/compras", icon: ShoppingBag, roles: ["encargado"] },
    ],
  },
  {
    label: "Administración",
    items: [
      { title: "Cierre del Día", url: "/cierre-del-dia", icon: ClipboardCheck, roles: ["encargado"] },
      { title: "Finanzas", url: "/finanzas", icon: Wallet, roles: ["encargado"] },
      { title: "Reportes", url: "/reportes", icon: BarChart3, roles: ["encargado"] },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Usuarios", url: "/usuarios", icon: Users, roles: ["encargado"] },
      { title: "Configuración", url: "/configuracion", icon: Settings, roles: ["encargado"] },
    ],
  },
];

export function AppSidebar() {
  const { state, setOpen } = useSidebar();
  const collapsed = state === "collapsed";
  const { role } = useAuth();

  // Filter groups by role
  const filteredGroups = menuGroups
    .map((group) => ({
      ...group,
      items: role ? group.items.filter((i) => i.roles.includes(role)) : group.items,
    }))
    .filter((group) => group.items.length > 0);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      toast.error("Error al cerrar sesión");
    }
  };

  return (
    <Sidebar collapsible="icon">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border">
        {!collapsed && (
          <h1 className="text-lg font-bold text-sidebar-foreground tracking-tight">
            Estilo Correntino
          </h1>
        )}
        <SidebarTrigger className={collapsed ? "mx-auto" : "ml-auto"} />
      </div>
      <SidebarContent>
        {filteredGroups.map((group, idx) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <p className="px-3 pt-3 pb-1 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                {group.label}
              </p>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end={false}
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        onClick={() => setOpen(false)}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
            {idx < filteredGroups.length - 1 && (
              <Separator className="mt-2 bg-sidebar-border" />
            )}
          </SidebarGroup>
        ))}
      </SidebarContent>
      <div className="mt-auto border-t border-sidebar-border p-2 space-y-1">
        <SidebarMenuButton asChild tooltip="Mi Cuenta">
          <NavLink
            to="/mi-cuenta"
            end
            className="hover:bg-sidebar-accent/50"
            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
            onClick={() => setOpen(false)}
          >
            <UserCircle className="h-5 w-5" />
            <span>Mi Cuenta</span>
          </NavLink>
        </SidebarMenuButton>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className="w-full justify-start text-sidebar-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Cerrar sesión</span>}
        </Button>
      </div>
    </Sidebar>
  );
}
