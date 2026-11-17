import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Copy, Lock, MessageCircle, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { customerSchema, MAX_QTY_PER_ITEM } from "@/lib/checkout-schema";
import { createOrder } from "@/lib/store.functions";
import { formatBRL, whatsappLink, type Product } from "@/lib/store";

export type Step = "cart" | "form" | "pix" | "done";
type Customer = { name: string; phone: string; address: string };
type PlacedOrder = { number: string; total: number; payload: string; items: string };

const TITLES: Record<Step, string> = {
  cart: "Seu carrinho",
  form: "Dados de entrega",
  pix: "Pague com Pix",
  done: "Aguardando confirmação",
};

export function CartSheet({
  open,
  onOpenChange,
  step,
  setStep,
  products,
  cart,
  changeQty,
  clearCart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: Step;
  setStep: (s: Step) => void;
  products: Product[];
  cart: Record<string, number>;
  changeQty: (id: string, delta: number) => void;
  clearCart: () => void;
}) {
  const submitOrder = useServerFn(createOrder);
  const [customer, setCustomer] = useState<Customer>({ name: "", phone: "", address: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Customer, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<PlacedOrder | null>(null);

  const lines = products.filter((p) => cart[p.id]).map((p) => ({ ...p, qty: cart[p.id] ?? 0 }));
  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = customerSchema.safeParse(customer);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof Customer, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Customer;
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await submitOrder({
        data: { ...parsed.data, items: lines.map((l) => ({ id: l.id, qty: l.qty })) },
      });
      setOrder({ ...result, items: lines.map((l) => `${l.qty}x ${l.name}`).join(", ") });
      setStep("pix");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const proofLink = order
    ? whatsappLink(
        `Olá! Paguei meu pedido via Pix.\nPedido: ${order.number}\nItens: ${order.items}\nTotal: ${formatBRL(order.total)}\nNome: ${customer.name}\n(segue o comprovante)`,
      )
    : "#";

  const field = (key: keyof Customer, label: string, props: React.ComponentProps<typeof Input>) => (
    <div className="space-y-1.5">
      <Label htmlFor={`f-${key}`}>{label}</Label>
      <Input
        id={`f-${key}`}
        value={customer[key]}
        onChange={(e) => setCustomer((c) => ({ ...c, [key]: e.target.value }))}
        aria-invalid={Boolean(errors[key])}
        className="h-11 rounded-xl bg-secondary"
        {...props}
      />
      {errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-l bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">{TITLES[step]}</SheetTitle>
          <SheetDescription className="sr-only">Finalize sua compra na BTV Store</SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {step === "cart" &&
            (lines.length === 0 ? (
              <p className="text-muted-foreground">Seu carrinho está vazio.</p>
            ) : (
              <div className="space-y-4">
                {lines.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-background/40 p-4">
                    <div>
                      <p className="font-semibold">{l.name}</p>
                      <p className="text-sm text-muted-foreground">{formatBRL(l.price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="secondary" className="size-8 rounded-full border" aria-label={`Remover um ${l.name}`} onClick={() => changeQty(l.id, -1)}>
                        {l.qty === 1 ? <Trash2 /> : <Minus />}
                      </Button>
                      <span className="w-5 text-center font-semibold">{l.qty}</span>
                      <Button size="icon" variant="secondary" className="size-8 rounded-full border" aria-label={`Adicionar mais um ${l.name}`} disabled={l.qty >= MAX_QTY_PER_ITEM} onClick={() => changeQty(l.id, 1)}>
                        <Plus />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-4 text-lg font-bold">
                  <span>Total</span>
                  <span>{formatBRL(total)}</span>
                </div>
                <Button variant="hero" size="lg" className="h-12 w-full rounded-full" onClick={() => setStep("form")}>
                  Finalizar compra
                </Button>
              </div>
            ))}

          {step === "form" && (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {field("name", "Nome completo", { autoComplete: "name", maxLength: 100 })}
              {field("phone", "WhatsApp (com DDD)", { autoComplete: "tel", inputMode: "tel", maxLength: 20, placeholder: "(21) 99999-9999" })}
              {field("address", "Endereço completo com CEP", { autoComplete: "street-address", maxLength: 300, placeholder: "Rua, número, bairro, cidade — CEP" })}
              <Button type="submit" variant="hero" size="lg" className="h-12 w-full rounded-full" disabled={submitting || lines.length === 0}>
                {submitting ? "Criando pedido..." : `Gerar Pix de ${formatBRL(total)}`}
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" /> Seus dados ficam protegidos e só são usados para a entrega.
              </p>
              <button type="button" className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setStep("cart")}>
                Voltar ao carrinho
              </button>
            </form>
          )}

          {step === "pix" && order && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Pedido <b className="text-foreground">{order.number}</b>
              </p>
              <div className="mx-auto w-fit rounded-2xl bg-qr p-4 text-qr-foreground">
                <QRCodeSVG value={order.payload} size={200} bgColor="transparent" fgColor="currentColor" />
              </div>
              <p className="font-display text-3xl font-bold">{formatBRL(order.total)}</p>
              <Button
                variant="outline"
                className="w-full rounded-full"
                onClick={() => {
                  navigator.clipboard.writeText(order.payload);
                  toast.success("Código Pix copiado");
                }}
              >
                <Copy /> Copiar Pix copia e cola
              </Button>
              <p className="text-sm text-muted-foreground">Abra o app do seu banco, pague o Pix e toque abaixo.</p>
              <Button
                variant="hero"
                size="lg"
                className="h-12 w-full rounded-full"
                onClick={() => {
                  setStep("done");
                  clearCart();
                }}
              >
                Já paguei
              </Button>
            </div>
          )}

          {step === "done" && order && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-accent/50 bg-background/40 p-5 text-center">
                <CheckCircle2 className="mx-auto text-accent" />
                <p className="mt-2 text-sm text-muted-foreground">Número do pedido</p>
                <p className="font-display text-2xl font-bold">{order.number}</p>
                <p className="mt-3 text-sm font-semibold text-accent">Pagamento em análise</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Envie o comprovante pelo WhatsApp. Assim que conferirmos o Pix, o{" "}
                <b className="text-foreground">código de entrega</b> aparece em "Acompanhar pedido" (use o número do
                pedido e os 4 últimos dígitos do seu WhatsApp). Guarde o número do pedido.
              </p>
              <Button variant="whatsapp" size="lg" className="h-12 w-full rounded-full" asChild>
                <a href={proofLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> Enviar comprovante
                </a>
              </Button>
              <Button variant="secondary" size="lg" className="h-12 w-full rounded-full border" asChild>
                <Link to="/pedido" search={{ n: order.number }}>
                  Acompanhar pedido
                </Link>
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
