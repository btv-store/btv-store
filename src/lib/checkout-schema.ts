import { z } from "zod";

// Shared by the checkout form (browser) and the order server functions.
export const MAX_QTY_PER_ITEM = 10;

const onlyDigits = (v: string) => v.replace(/\D/g, "");

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Informe seu nome completo")
    .max(100, "Nome muito longo")
    .regex(/^[\p{L}\p{M} .'-]+$/u, "Use apenas letras no nome"),
  phone: z
    .string()
    .trim()
    .max(20, "WhatsApp inválido")
    .refine((v) => {
      const d = onlyDigits(v);
      return d.length >= 10 && d.length <= 13;
    }, "Informe o WhatsApp com DDD"),
  address: z
    .string()
    .trim()
    .min(10, "Informe o endereço completo com CEP")
    .max(300, "Endereço muito longo")
    .refine((v) => /\d{5}-?\d{3}/.test(v), "Inclua o CEP (ex.: 20000-000)"),
});

export const cartItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,20}$/),
  qty: z.number().int().min(1).max(MAX_QTY_PER_ITEM),
});

export const createOrderSchema = customerSchema.extend({
  items: z.array(cartItemSchema).min(1, "Carrinho vazio").max(10),
});

export const trackOrderSchema = z.object({
  number: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^BTV[0-9A-F]{10}$/, "Número do pedido inválido"),
  last4: z.string().regex(/^\d{4}$/, "Informe os 4 últimos dígitos"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
