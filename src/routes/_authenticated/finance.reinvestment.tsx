import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app/AppShell";
import { getReinvestmentTimeline } from "@/lib/finance.functions";
import { formatBDT, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/finance/reinvestment")({
  head: () => ({ meta: [{ title: "Reinvestment — Hanami" }] }),
  component: ReinvestmentPage,
});

function ReinvestmentPage() {
  const fn = useServerFn(getReinvestmentTimeline);
  const { data } = useSuspenseQuery({ queryKey: ["reinvestment"], queryFn: () => fn() });
  const total = data.reduce((s, d) => s + d.amount, 0);

  return (
    <AppShell hideNav title="Reinvestment" subtitle="Money flow">
      <div className="card-soft bg-primary p-5 text-primary-foreground">
        <p className="text-xs uppercase tracking-wider opacity-80">Reinvested last 90 days</p>
        <p className="num mt-1 text-3xl font-black">{formatBDT(total)}</p>
      </div>

      {data.length === 0 ? (
        <div className="card-soft mt-4 p-8 text-center text-sm text-muted-foreground">
          No reinvestments yet. Toggle "Reinvestment" when adding an expense.
        </div>
      ) : (
        <div className="mt-4">
          <ol className="relative ml-3 border-l-2 border-dashed border-border pl-5">
            {data.map((e) => (
              <li key={e.id} className="mb-5 last:mb-0">
                <span className="absolute -left-[7px] grid h-3 w-3 place-items-center rounded-full bg-primary ring-4 ring-background" />
                <div className="card-soft p-3">
                  <p className="text-sm font-medium">{e.description ?? e.category ?? "Reinvestment"}</p>
                  <p className="text-xs text-muted-foreground">{e.category ?? "—"} · {fmtDate(e.spent_at)}</p>
                  <p className="num mt-1 text-base font-bold text-primary">-{formatBDT(e.amount)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </AppShell>
  );
}
