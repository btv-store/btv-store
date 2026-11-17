// Builds a static Pix "copia e cola" (BR Code / EMV) payload.
const field = (id: string, value: string) => id + value.length.toString().padStart(2, "0") + value;

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const clean = (value: string, max: number) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .slice(0, max);

export function buildPixPayload(opts: {
  key: string;
  amount: number;
  txid: string;
  name: string;
  city: string;
}): string {
  const body =
    field("00", "01") +
    field("26", field("00", "br.gov.bcb.pix") + field("01", opts.key)) +
    field("52", "0000") +
    field("53", "986") +
    field("54", opts.amount.toFixed(2)) +
    field("58", "BR") +
    field("59", clean(opts.name, 25)) +
    field("60", clean(opts.city, 15)) +
    field("62", field("05", clean(opts.txid, 25).replace(/ /g, "") || "***")) +
    "6304";
  return body + crc16(body);
}
