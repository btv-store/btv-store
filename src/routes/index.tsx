import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Check, Headphones, MessageCircle, QrCode, ShieldCheck, ShoppingCart, Truck, Tv } from "lucide-react";

import poster from "@/assets/btv-stick-poster.webp.asset.json";
import { Button } from "@/components/ui/button";
import { CartSheet, type Step } from "@/components/store/CartSheet";
import { SiteFooter, SiteHeader } from "@/components/store/SiteHeader";
import { FloatingWhatsApp } from "@/components/store/WhatsAppIcon";
import { MAX_QTY_PER_ITEM } from "@/lib/checkout-schema";
import { formatBRL, whatsappLink } from "@/lib/store";
import { getProducts } from "@/lib/store.functions";

const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: () => getProducts(),
  staleTime: 5 * 60 * 1000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BTV Store — Sua TV comum vira Smart TV" },
      { name: "description", content: "BTV Stick com frete grátis, 1 ano de garantia e pagamento por Pix na BTV Store." },
      { property: "og:title", content: "BTV Store — Sua TV comum vira Smart TV" },
      { property: "og:description", content: "Conecte no HDMI e assista filmes, séries e apps. Pague com Pix." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery),
  component: Index,
});

const STATS = [
  ["4K", "Imagem ultra nítida"],
  ["Plug & Play", "Instala em 1 minuto"],
  ["1 ano", "De garantia"],
] as const;

const TRUST = [
  [Truck, "Frete grátis para todo o Brasil"],
  [QrCode, "Pagamento via Pix"],
  [ShieldCheck, "Compra segura"],
  [Headphones, "Suporte pelo WhatsApp"],
] as const;

function Index() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("cart");

  const count = Object.values(cart).reduce((a, b) => a + b, 0);

  const changeQty = (id: string, delta: number) =>
    setCart((c) => {
      const next = Math.min(MAX_QTY_PER_ITEM, (c[id] ?? 0) + delta);
      const copy = { ...c };
      if (next <= 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });

  const addToCart = (id: string) => {
    changeQty(id, 1);
    setStep("cart");
    setOpen(true);
  };

  return (
    <main className="bg-hero min-h-screen">
      <SiteHeader>
        <a href="#produtos" className="text-muted-foreground transition-colors hover:text-foreground">
          Produtos
        </a>
        <Link to="/pedido" className="text-muted-foreground transition-colors hover:text-foreground">
          Meu pedido
        </Link>
        <Button
          variant="secondary"
          size="icon"
          className="relative rounded-full border"
          aria-label={`Carrinho${count ? `, ${count} itens` : ""}`}
          onClick={() => setOpen(true)}
        >
          <ShoppingCart />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </SiteHeader>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-10 md:grid-cols-2 md:py-14">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-sm text-accent">
            <Truck className="size-4" /> Frete grátis para todo o Brasil
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl md:text-6xl">
            Sua TV comum vira <span className="text-gradient-primary">Smart TV</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Conecte na entrada HDMI e assista filmes, séries, esportes e apps em segundos.
          </p>
          <div className="mt-6 flex w-fit items-center gap-4 rounded-2xl border border-primary/30 bg-card p-4 shadow-glow">
            <span className="grid size-12 place-items-center rounded-full bg-gradient-primary text-primary-foreground">
              <QrCode />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Pagamento instantâneo</p>
              <p className="font-display text-2xl font-bold">
                Pague com <span className="text-gradient-primary">Pix</span>
              </p>
              <p className="text-xs text-muted-foreground">aprovação rápida e segura</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" variant="hero" className="h-12 rounded-full" asChild>
              <a href="#produtos">Ver modelos</a>
            </Button>
            <Button size="lg" variant="secondary" className="h-12 rounded-full border" asChild>
              <a href={whatsappLink("Olá! Quero comprar o BTV Stick.")} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="text-whatsapp" /> Falar no WhatsApp
              </a>
            </Button>
          </div>
        </div>
        <img
          src={poster.url}
          alt="BTV Stick com controle remoto"
          width={1200}
          height={1200}
          className="animate-float w-full rounded-3xl border border-primary/30 shadow-glow"
        />
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-3 gap-3 px-5">
        {STATS.map(([value, label]) => (
          <div key={value} className="rounded-2xl border bg-card p-4 text-center">
            <p className="font-display text-lg font-bold text-gradient-primary sm:text-xl">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-3 grid max-w-6xl gap-3 px-5 sm:grid-cols-2">
        {TRUST.map(([Icon, label]) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
            <Icon className="size-5 shrink-0 text-primary" />
            {label}
          </div>
        ))}
      </section>

      <section id="produtos" className="mx-auto max-w-6xl scroll-mt-20 px-5 pt-20">
        <h2 className="text-center text-3xl font-extrabold md:text-4xl">Escolha seu BTV Stick</h2>
        <p className="mt-3 text-center text-muted-foreground">
          Todos com frete grátis, 1 ano de garantia e pagamento via Pix.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {products.map((p) => (
            <div
              key={p.id}
              className={`relative rounded-3xl border bg-card p-6 ${p.best ? "border-primary/60 shadow-glow" : ""}`}
            >
              {p.best && (
                <span className="absolute -top-3 right-6 rounded-full bg-gradient-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Mais vendido
                </span>
              )}
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-secondary text-primary">
                  <Tv className="size-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <p className="text-xs tracking-[0.3em] text-muted-foreground">{p.tag}</p>
                </div>
              </div>
              <p className="mt-6 font-display text-4xl font-extrabold">{formatBRL(p.price)}</p>
              <p className="text-sm text-muted-foreground">à vista no Pix</p>
              <ul className="mt-5 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className={`flex items-center gap-3 ${f === "Frete grátis" ? "text-accent" : ""}`}>
                    <Check className="size-4 text-primary" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={p.best ? "hero" : "outline"}
                size="lg"
                className="mt-6 h-11 w-full rounded-full"
                onClick={() => addToCart(p.id)}
              >
                <ShoppingCart /> Adicionar ao carrinho
              </Button>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
      <FloatingWhatsApp />

      <CartSheet
        open={open}
        onOpenChange={setOpen}
        step={step}
        setStep={setStep}
        products={products}
        cart={cart}
        changeQty={changeQty}
        clearCart={() => setCart({})}
      />
    </main>
  );
}
