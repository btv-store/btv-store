// Public store configuration and helpers shared by browser and server code.
export const STORE_NAME = "BTV Store";
export const WHATSAPP_NUMBER = "5521973231992";

export const whatsappLink = (message: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

export const formatBRL = (value: number) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const ORDER_STEPS = [
  { key: "aguardando_pagamento", label: "Aguardando pagamento" },
  { key: "pagamento_confirmado", label: "Pagamento confirmado" },
  { key: "enviado", label: "Enviado" },
  { key: "entregue", label: "Entregue" },
] as const;

export type OrderStatus = (typeof ORDER_STEPS)[number]["key"] | "cancelado";

export const statusLabel = (status: string) =>
  status === "cancelado"
    ? "Cancelado"
    : (ORDER_STEPS.find((s) => s.key === status)?.label ?? status);

export type Product = {
  id: string;
  name: string;
  tag: string;
  price: number;
  features: string[];
  best: boolean;
};

export type OrderItem = { id: string; name: string; price: number; qty: number };
