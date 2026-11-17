import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/store";

export function FloatingWhatsApp() {
  return (
    <a
      href={whatsappLink("Olá! Quero comprar na BTV Store.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-30 grid size-14 place-items-center rounded-full bg-whatsapp text-whatsapp-foreground shadow-glow transition-transform hover:scale-105"
    >
      <MessageCircle className="size-7" />
    </a>
  );
}
