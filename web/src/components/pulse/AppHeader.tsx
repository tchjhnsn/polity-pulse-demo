import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Top nav — the demo as a simplified main-app (audit A1/A2 fix).
 * Replaces the nested Orient/Live-Pulse tabs with real routes.
 * Mirrors apps/web SiteHeader: wordmark + section links, active state,
 * hamburger below the mobile breakpoint.
 */
const NAV: ReadonlyArray<{ label: string; to: string; match: (p: string) => boolean }> = [
  { label: "Orient", to: "/", match: (p) => p === "/" },
  { label: "Reps", to: "/reps", match: (p) => p.startsWith("/reps") || p.startsWith("/rep/") },
  { label: "Bills", to: "/bills", match: (p) => p.startsWith("/bill") },
  { label: "Pulse", to: "/pulse", match: (p) => p.startsWith("/pulse") },
];

export function AppHeader() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-[860px] items-center justify-between px-4 py-3">
        <Link
          to="/"
          className="text-[17px] font-semibold text-accent-blue"
          onClick={() => setOpen(false)}
        >
          Polity Pulse
        </Link>

        <button
          type="button"
          className="text-ink-2 sm:hidden"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav className="hidden items-center gap-5 sm:flex" aria-label="Sections">
          {NAV.map((n) => {
            const active = n.match(pathname);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "text-small transition-colors",
                  active
                    ? "font-medium text-ink underline underline-offset-4"
                    : "text-ink-3 hover:text-ink-2",
                )}
                aria-current={active ? "page" : undefined}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {open && (
        <nav
          className="flex flex-col gap-1 border-t border-rule px-4 py-2 sm:hidden"
          aria-label="Sections"
        >
          {NAV.map((n) => {
            const active = n.match(pathname);
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "py-1.5 text-small",
                  active ? "font-medium text-ink" : "text-ink-2",
                )}
                aria-current={active ? "page" : undefined}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
