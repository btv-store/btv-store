import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Package, Search } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter, SiteHeader } from "@/components/store/SiteHeader";
import { trackOrderSchema } from "@/lib/checkout-schema";
import { formatBRL, ORDER_STEPS, statusLabel } from "@/lib/store";
import { trackOrder } from "@/lib/store.functions";

const searchSchema = z.object({
  n: z
    .string()
    .regex(/^[A-Za-z0-9]{1,20}$/)
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/pedido")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Acompanhar pedido — BTV Store" },
      { name: "description", content: "Consulte o status e o código de entrega do seu pedido na BTV Store." },
      { property: "og:title", content: "Acompanhar pedido — BTV Store" },
      { property: "og:description", content: "Veja o status do seu pedido com o número e os 4 últimos dígitos do WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrackOrderPage,
});

type Tracked = NonNullable<Awaited<ReturnType<typeof trackOrder>>>;

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";

function TrackOrderPage() {
  const { n } = Route.useSearch();
  const lookup = useServerFn(trackOrder);
  const [number, setNumber] = useState(n ?? "");
  const [last4, setLast4] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<Tracked | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const parsed = trackOrderSchema.safeParse({ number, last4 });
    if (!parsed.success) {
      setOrder(null);
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      const result = await lookup({ data: parsed.data });
      setOrder(result);
      if (!result) setError("Pedido não encontrado. Confira o número e os 4 últimos dígitos do WhatsApp.");
    } catch {
      setOrder(null);
      setError("Não foi possível consultar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = order ? ORDER_STEPS.findIndex((s) => s.key === order.status) : -1;
  const stepDates = order ? [order.created_at, order.paid_at, order.shipped_at, order.delivered_at] : [];

  return (
    <main className="bg-hero min-h-screen">
      <SiteHeader>
        <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
          Loja
        </Link>
      </SiteHeader>

      <section className="mx-auto max-w-lg px-5 py-10">
        <h1 className="text-3xl font-extrabold">Acompanhar pedido</h1>
        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4 rounded-3xl border bg-card p-5">
          <div className="space-y-1.5">
            <Label htmlFor="num">Número do pedido</Label>
            <Input
              id="num"
              value={number}
              onChange={(e) => setNumber(e.target.value.toUpperCase())}
              placeholder="BTV1A2B3C4D5E"
              maxLength={13}
              autoComplete="off"
              className="h-11 rounded-xl bg-secondary"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l4">4 últimos dígitos do WhatsApp</Label>
            <Input
              id="l4"
              inputMode="numeric"
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))}
              autoComplete="off"
              className="h-11 rounded-xl bg-secondary"
            />
          </div>
          <Button type="submit" variant="hero" size="lg" className="h-12 w-full rounded-full" disabled={loading}>
            <Search /> {loading ? "Buscando..." : "Consultar"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>

        {order && (
          <div className="mt-6 space-y-5 rounded-3xl border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Pedido</p>
                <p className="font-display text-xl font-bold">{order.order_number}</p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-sm text-primary">{statusLabel(order.status)}</span>
            </div>

            {order.delivery_code ? (
              <div className="rounded-2xl border border-primary/50 p-4 text-center shadow-glow">
                <p className="text-sm text-muted-foreground">Código de entrega</p>
                <p className="font-display text-4xl font-extrabold tracking-[0.3em] text-gradient-primary">
                  {order.delivery_code}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Informe ao entregador ao receber</p>
              </div>
            ) : (
              order.status !== "cancelado" && (
                <p className="rounded-2xl border border-accent/40 p-4 text-sm text-accent">
                  O código de entrega aparece aqui assim que confirmarmos seu Pix.
                </p>
              )
            )}

            {order.status !== "cancelado" && (
              <ol className="space-y-4">
                {ORDER_STEPS.map((s, i) => (
                  <li key={s.key} className="flex items-center gap-3">
                    <span
                      className={`grid size-8 place-items-center rounded-full text-sm ${
                        i <= stepIndex ? "bg-gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i <= stepIndex ? <Check className="size-4" /> : i + 1}
                    </span>
                    <div>
                      <p className={i <= stepIndex ? "font-semibold" : "text-muted-foreground"}>{s.label}</p>
                      {stepDates[i] && <p className="text-xs text-muted-foreground">{formatDate(stepDates[i])}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {order.tracking_code && (
              <p className="text-sm">
                <Package className="mr-1 inline size-4 text-primary" /> Código de rastreio: <b>{order.tracking_code}</b>
              </p>
            )}

            <div className="border-t pt-4 text-sm">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>
                    {item.qty}x {item.name}
                  </span>
                  <span>{formatBRL(item.price * item.qty)}</span>
                </div>
              ))}
              <div className="mt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>{formatBRL(order.total)}</span>
              </div>
            </div>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
