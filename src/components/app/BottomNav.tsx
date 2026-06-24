import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Package, Wallet, BarChart3, Menu, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/products", label: "Products", icon: Package },
  { to: "/finance", label: "Finance", icon: Wallet },
  { to: "/analytics", label: "Stats", icon: BarChart3 },
  { to: "/more", label: "More", icon: Menu },
] as const;

export function BottomNav({ onFab }: { onFab?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-3 left-1/2 z-40 -translate-x-1/2 px-3 w-full max-w-md"
    >
      <div className="relative card-soft flex items-center justify-between gap-1 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        {tabs.slice(0, 2).map((t) => (
          <TabLink key={t.to} {...t} active={pathname.startsWith(t.to)} />
        ))}
        <button
          aria-label="Record sale"
          onClick={onFab}
          className="grid h-14 w-14 -translate-y-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </button>
        {tabs.slice(2).map((t) => (
          <TabLink
            key={t.to}
            {...t}
            active={
              t.to === "/more"
                ? !tabs.slice(0, 4).some((x) => pathname.startsWith(x.to))
                : pathname.startsWith(t.to)
            }
          />
        ))}
      </div>
    </nav>
  );
}

function TabLink({
  to, label, icon: Icon, active,
}: { to: string; label: string; icon: typeof Home; active: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[11px] transition",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("h-5 w-5", active && "fill-primary/15 stroke-primary")} />
      <span className="font-medium">{label}</span>
    </Link>
  );
}
