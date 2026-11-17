import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function Logo() {
  return (
    <Link to="/" className="font-display text-xl font-extrabold tracking-tight" aria-label="BTV Store — início">
      BTV<span className="text-gradient-primary">STORE</span>
    </Link>
  );
}

export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
        <Logo />
        <nav className="flex items-center gap-4 text-sm">{children}</nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-display font-bold text-foreground">BTV Store</span> · Pagamento via Pix ·
          Frete grátis para todo o Brasil
        </p>
        <p>© {new Date().getFullYear()} BTV Store</p>
      </div>
    </footer>
  );
}
