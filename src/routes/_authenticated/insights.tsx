import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app/AppShell";
import { getInsights } from "@/lib/insights.functions";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "Insights — Hanami" }] }),
  component: InsightsPage,
});

function InsightsPage() {
  const fn = useServerFn(getInsights);
  const { data } = useSuspenseQuery({ queryKey: ["insights"], queryFn: () => fn() });

  return (
    <AppShell hideNav title="Insights" subtitle="What's happening">
      <div className="card-soft mb-3 flex items-center gap-3 bg-gradient-to-br from-secondary to-card p-4">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="font-display text-base font-bold">Powered by Hanami AI</p>
          <p className="text-xs text-muted-foreground">Auto-generated from your sales & inventory data.</p>
        </div>
      </div>
      <div className="grid gap-3">
        {data.map((i) => {
          const toneCls = i.tone === "good" ? "bg-profit/10 border-profit/25"
            : i.tone === "warn" ? "bg-warn/10 border-warn/25"
              : "bg-info/10 border-info/25";
          return (
            <article key={i.id} className={`card-soft border ${toneCls} p-4`}>
              <p className="text-2xl">{i.emoji}</p>
              <h3 className="mt-1 font-display text-base font-bold leading-snug">{i.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{i.detail}</p>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
