import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app/AppShell";
import { getAnalytics } from "@/lib/analytics.functions";
import { formatBDT } from "@/lib/format";
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Hanami" }] }),
  component: AnalyticsPage,
});

const CHART_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)", "var(--color-lavender)"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function AnalyticsPage() {
  const fn = useServerFn(getAnalytics);
  const { data } = useSuspenseQuery({ queryKey: ["analytics"], queryFn: () => fn() });
  const growthUp = data.growth_pct >= 0;
  const heatMax = Math.max(...data.weekday_heatmap.map((w) => w.revenue), 1);

  return (
    <AppShell title="Analytics" subtitle="Business pulse"
      right={<Link to="/insights" className="chip text-primary"><Sparkles className="h-3 w-3" /> Insights</Link>}
    >
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Revenue (this month)" value={formatBDT(data.revenue_this_month)} />
        <Stat
          label="Growth vs last"
          value={`${growthUp ? "+" : ""}${Math.round(data.growth_pct)}%`}
          tone={growthUp ? "profit" : "expense"}
          icon={growthUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
        />
        <Stat label="Margin" value={`${Math.round(data.margin_pct)}%`} />
        <Stat label="Avg order" value={formatBDT(data.avg_order_value)} />
        <Stat label="Returning" value={`${Math.round(data.returning_customers_pct)}%`} />
        <Stat label="Best month" value={data.best_month?.month ?? "—"} sub={data.best_month ? formatBDT(data.best_month.revenue) : ""} />
      </div>

      <section className="mt-3 card-soft p-4">
        <h2 className="mb-2 font-display text-base font-bold">12-month revenue</h2>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.monthly_revenue}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatBDT(v)}
                contentStyle={{ borderRadius: 14, border: "1px solid var(--color-border)" }} />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="profit" stroke="var(--color-profit)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-3 card-soft p-4">
        <h2 className="mb-2 font-display text-base font-bold">Platform breakdown</h2>
        {data.platform_breakdown.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No sales yet.</p>
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.platform_breakdown} dataKey="revenue" nameKey="platform" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {data.platform_breakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatBDT(v)}
                  contentStyle={{ borderRadius: 14, border: "1px solid var(--color-border)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          {data.platform_breakdown.map((p, i) => (
            <span key={p.platform} className="chip">
              <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              {p.platform}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-3 card-soft p-4">
        <h2 className="mb-2 font-display text-base font-bold">Best sales days</h2>
        <div className="grid grid-cols-7 gap-1.5">
          {data.weekday_heatmap.map((w) => {
            const intensity = w.revenue / heatMax;
            return (
              <div key={w.weekday} className="flex flex-col items-center gap-1">
                <div className="h-12 w-full rounded-xl border border-border"
                  style={{ background: `color-mix(in oklab, var(--color-primary) ${Math.round(intensity * 90)}%, var(--color-card))` }} />
                <span className="text-[10px] text-muted-foreground">{WEEKDAYS[w.weekday]}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-3 card-soft p-4">
        <h2 className="mb-2 font-display text-base font-bold">Profit by product</h2>
        {data.product_profit.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Add sales to see this.</p>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.product_profit} layout="vertical" margin={{ left: 0, right: 0 }}>
                <Tooltip formatter={(v: number) => formatBDT(v)}
                  contentStyle={{ borderRadius: 14, border: "1px solid var(--color-border)" }} />
                <Bar dataKey="profit" fill="var(--color-primary)" radius={[6, 6, 6, 6]} />
                <XAxis type="number" hide />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="mt-3 grid grid-cols-1 gap-3">
        {data.top_product && <Insight label="Top product" name={data.top_product.name} value={`${formatBDT(data.top_product.revenue)} · ${Math.round(data.top_product.margin)}% margin`} tone="profit" />}
        {data.worst_product && <Insight label="Lowest product" name={data.worst_product.name} value={`${formatBDT(data.worst_product.revenue)} · ${Math.round(data.worst_product.margin)}% margin`} tone="expense" />}
        {data.most_expensive_material && <Insight label="Biggest material spend" name={data.most_expensive_material.name} value={formatBDT(data.most_expensive_material.spent)} />}
      </section>
    </AppShell>
  );
}

function Stat({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone?: "profit" | "expense"; icon?: React.ReactNode }) {
  const cls = tone === "profit" ? "text-profit" : tone === "expense" ? "text-expense" : "";
  return (
    <div className="card-soft p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`num mt-1 flex items-center gap-1 text-lg font-bold ${cls}`}>
        {icon}{value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
function Insight({ label, name, value, tone }: { label: string; name: string; value: string; tone?: "profit" | "expense" }) {
  return (
    <div className="card-soft flex items-center justify-between p-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-display text-base font-bold">{name}</p>
      </div>
      <span className={`num text-sm font-semibold ${tone === "profit" ? "text-profit" : tone === "expense" ? "text-expense" : ""}`}>{value}</span>
    </div>
  );
}
