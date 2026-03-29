import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { signIn } from "@/lib/auth-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Auth() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error("Ingresá email y contraseña");
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      nav("/stock");
    } catch (e: any) {
      toast.error(e.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Estilo Correntino</CardTitle>
          <CardDescription>Ingresá con tu cuenta para continuar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Usuario</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="tu@email.com"
            />
          </div>
          <div className="space-y-1">
            <Label>Contraseña</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="••••••••"
            />
          </div>
          <Button className="w-full" onClick={handleLogin} disabled={loading}>
            {loading ? "Ingresando…" : "Ingresar"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Tu cuenta es creada por el encargado desde el panel de Usuarios.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
