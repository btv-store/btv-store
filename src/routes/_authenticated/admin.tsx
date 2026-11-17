import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/store/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { listOrders, setOrderStatus } from "@/lib/admin.functions";
import { formatBRL, statusLabel } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel de pedidos — BTV Store" },
      { name: "description", content: "Gerencie os pedidos da BTV Store." },
      { property: "og:title", content: "Painel de pedidos — BTV Store" },
      { property: "og:description", content: "Gerencie os pedidos da BTV Store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

const NEXT_ACTION: Record<string, { to: "pagamento_confirmado" | "enviado" | "entregue"; label: string }> = {
  aguardando_pagamento: { to: "pagamento_confirmado", label: "Confirmar Pix recebido" },
  pagamento_confirmado: { to: "enviado", label: "Marcar como enviado" },
  enviado: { to: "entregue", label: "Marcar como entregue" },
};

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchOrders = useServerFn(listOrders);
  const updateStatus = useServerFn(setOrderStatus);
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const ordersQuery = queryOptions({ queryKey: ["admin-orders"], queryFn: () => fetchOrders(), retry: false });
  const { data: orders, error, isPending } = useQuery(ordersQuery);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const change = async (orderId: string, orderNumber: string, status: "pagamento_confirmado" | "enviado" | "entregue" | "cancelado") => {
    if (status === "cancelado" && !window.confirm(`Cancelar o pedido ${orderNumber}?`)) return;
    setBusy(orderId);
    try {
      await updateStatus({ data: { orderId, status, tracking: tracking[orderId] || undefined } });
      toast.success(`Pedido ${orderNumber}: ${statusLabel(status)}`);
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="bg-hero min-h-screen">
      <SiteHeader>
        <span className="text-muted-foreground">Painel</span>
        <Button variant="secondary" className="rounded-full border" onClick={signOut}>
          Sair
        </Button>
      </SiteHeader>

      <section className="mx-auto max-w-3xl space-y-4 px-5 py-8">
        <h1 className="text-2xl font-extrabold">Pedidos</h1>
        {isPending && <p className="text-muted-foreground">Carregando...</p>}
        {error && (
          <p className="rounded-2xl border border-destructive/50 bg-card p-5 text-sm text-destructive">
            {error.message.includes("administradores")
              ? "Esta conta não tem acesso de administrador."
              : "Não foi possível carregar os pedidos."}
          </p>
        )}
        {orders && orders.length === 0 && <p className="text-muted-foreground">Nenhum pedido ainda.</p>}
        {orders?.map((o) => {
          const next = NEXT_ACTION[o.status];
          return (
            <div key={o.id} className="space-y-3 rounded-3xl border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display font-bold">{o.order_number}</p>
                <span className="rounded-full bg-muted px-3 py-1 text-sm text-primary">{statusLabel(o.status)}</span>
              </div>
              <p className="text-sm">
                <b>{o.customer_name}</b> · {o.customer_phone}
                <br />
                <span className="text-muted-foreground">{o.address}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {o.items.map((i) => `${i.qty}x ${i.name}`).join(", ")} — <b className="text-foreground">{formatBRL(o.total)}</b>
              </p>
              {o.delivery_code && (
                <p className="text-sm">
                  Código de entrega: <b className="tracking-widest text-primary">{o.delivery_code}</b>
                </p>
              )}
              {o.status === "pagamento_confirmado" && (
                <Input
                  placeholder="Código de rastreio (opcional)"
                  maxLength={60}
                  value={tracking[o.id] ?? ""}
                  onChange={(e) => setTracking({ ...tracking, [o.id]: e.target.value })}
                  className="rounded-xl bg-secondary"
                />
              )}
              <div className="flex flex-wrap gap-2">
                {next && (
                  <Button variant="hero" className="rounded-full" disabled={busy === o.id} onClick={() => change(o.id, o.order_number, next.to)}>
                    {next.label}
                  </Button>
                )}
                {o.status === "aguardando_pagamento" && (
                  <Button variant="secondary" className="rounded-full border" disabled={busy === o.id} onClick={() => change(o.id, o.order_number, "cancelado")}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
