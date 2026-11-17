import { describe, expect, it } from "vitest";
import { createOrderSchema, trackOrderSchema } from "@/lib/checkout-schema";
import { buildPixPayload, crc16 } from "@/lib/pix";

const validOrder = {
  name: "Maria da Silva",
  phone: "(21) 97323-1992",
  address: "Rua das Flores, 100, Centro, Rio de Janeiro - 20000-000",
  items: [{ id: "4k", qty: 1 }],
};

describe("checkout validation", () => {
  it("accepts a complete order", () => {
    expect(createOrderSchema.safeParse(validOrder).success).toBe(true);
  });

  it("rejects more than 10 units of one product", () => {
    const r = createOrderSchema.safeParse({ ...validOrder, items: [{ id: "4k", qty: 11 }] });
    expect(r.success).toBe(false);
  });

  it("rejects a client-supplied price field being trusted (only id and qty are kept)", () => {
    const r = createOrderSchema.parse({ ...validOrder, items: [{ id: "4k", qty: 1, price: 0.01 }] });
    expect(r.items[0]).toEqual({ id: "4k", qty: 1 });
  });

  it("requires a WhatsApp number with area code", () => {
    expect(createOrderSchema.safeParse({ ...validOrder, phone: "97323" }).success).toBe(false);
  });

  it("requires a CEP in the address", () => {
    expect(createOrderSchema.safeParse({ ...validOrder, address: "Rua das Flores, 100, Centro" }).success).toBe(false);
  });

  it("tracking needs the order number and exactly 4 phone digits", () => {
    expect(trackOrderSchema.safeParse({ number: "btv1a2b3c4d5e", last4: "1992" }).success).toBe(true);
    expect(trackOrderSchema.safeParse({ number: "BTV1A2B3C4D5E", last4: "199" }).success).toBe(false);
  });
});

describe("Pix payload", () => {
  it("includes amount, key, merchant name and a valid CRC", () => {
    const payload = buildPixPayload({
      key: "21053373767",
      amount: 299.9,
      txid: "BTV1A2B3C4D5E",
      name: "BTV STORE",
      city: "RIO DE JANEIRO",
    });
    expect(payload).toContain("5406299.90");
    expect(payload).toContain("011121053373767");
    expect(payload).toContain("5909BTV STORE");
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });
});
