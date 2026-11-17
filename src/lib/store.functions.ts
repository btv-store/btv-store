import { createServerFn } from "@tanstack/react-start";
import { createOrderSchema, trackOrderSchema } from "@/lib/checkout-schema";
import { buildPixPayload } from "@/lib/pix";
import { createPublicSupabase } from "@/lib/public-supabase";
import type { OrderItem, Product } from "@/lib/store";

export const getProducts = createServerFn({ method: "GET" }).handler(async (): Promise<Product[]> => {
  const supabase = createPublicSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, tag, price, features, best")
    .order("sort", { ascending: true });
  if (error) {
    console.error("getProducts failed", error.code);
    throw new Error("Não foi possível carregar os produtos");
  }
  return (data ?? []).map((p) => ({ ...p, price: Number(p.price) }));
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createOrderSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createPublicSupabase();
    // Prices and totals are computed by the database from the products table; the client
    // only sends product ids and quantities.
    const { data: rows, error } = await supabase.rpc("create_order", {
      _name: data.name,
      _phone: data.phone,
      _address: data.address,
      _items: data.items,
    });
    const row = rows?.[0];
    if (error || !row) {
      // Only validation messages raised on purpose (SQLSTATE 22023) are shown to the customer.
      const message =
        error?.code === "22023" ? error.message : "Não foi possível criar o pedido. Tente novamente.";
      throw new Error(message);
    }
    const total = Number(row.total);
    const payload = buildPixPayload({
      key: "21053373767",
      amount: total,
      txid: row.order_number,
      name: "BTV STORE",
      city: "RIO DE JANEIRO",
    });
    return { number: row.order_number, total, payload };
  });

export const trackOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => trackOrderSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createPublicSupabase();
    const { data: rows, error } = await supabase.rpc("track_order", {
      _number: data.number,
      _phone_last4: data.last4,
    });
    if (error) {
      console.error("trackOrder failed", error.code);
      throw new Error("Não foi possível consultar agora. Tente novamente.");
    }
    const row = rows?.[0];
    if (!row) return null;
    return {
      ...row,
      total: Number(row.total),
      items: (row.items as unknown as OrderItem[]).map((i) => ({ ...i, price: Number(i.price) })),
    };
  });
