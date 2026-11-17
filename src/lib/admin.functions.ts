import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { OrderItem } from "@/lib/store";

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !isAdmin) throw new Error("Acesso restrito a administradores");
}

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error("Não foi possível carregar os pedidos");
    return (data ?? []).map((o) => ({
      ...o,
      total: Number(o.total),
      items: o.items as unknown as OrderItem[],
    }));
  });

const setStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["pagamento_confirmado", "enviado", "entregue", "cancelado"]),
  tracking: z
    .string()
    .trim()
    .max(60)
    .regex(/^[A-Za-z0-9 -]*$/, "Código de rastreio inválido")
    .optional(),
});

export const setOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("admin_set_status", {
      _order_id: data.orderId,
      _status: data.status,
      ...(data.tracking ? { _tracking: data.tracking } : {}),
    });
    if (error) {
      throw new Error(error.code === "22023" ? error.message : "Não foi possível atualizar o pedido");
    }
    return { ok: true };
  });
