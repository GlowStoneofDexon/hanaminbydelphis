import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { getDashboardSnapshot, type DashboardSnapshot } from "@/lib/dashboard.functions";
import { formatBDT, greeting, fmtDate } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { ArrowUpRight, Package, ShoppingBag, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Home — Hanami" }] }),
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(getDashboardSnapshot);
  const { data } = useSuspenseQuery({
    queryKey: ["dashboard"],
    queryFn: () => fn() as Promise<DashboardSnapshot>,
  });
  const [mode, setMode] = useState<"day" | "month">("day");

  const chartData = mode === "day"
    ? data.revenue_7d.map((d) => ({
        label: d.day.slice(5),
        sales: Math.round(d.revenue),
        profit: Math.round(d.profit),
      }))
    : data.revenue_6m.map((m) => {
        const [, mm] = m.month.split("-");
        const name = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(mm) - 1] ?? mm;
        return { label: name, sales: Math.round(m.revenue), profit: Math.round(m.profit) };
      });

  return (
    <AppShell
      subtitle={greeting() + ","}
      title={data.display_name ?? "there"}
    >
      {/* Hero KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiHero label="Today's sales" value={formatBDT(data.today_sales)} tone="primary" />
        <KpiHero label="Today's profit" value={formatBDT(data.today_profit)} tone="profit" />
      </div>

      {/* Mini KPIs */}
      <div className="mt-3 grid grid-cols-1 gap-3">
        <KpiMini
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Pending orders"
          value={String(data.pending_orders)}
          link="/orders"
        />
      </div>

      {/* Cash flow — Sales vs Profit */}
      <section className="mt-3 card-soft p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {mode === "day" ? "Last 7 days" : "Last 6 months"}
            </p>
            <h2 className="font-display text-lg font-bold">Cash flow</h2>
          </div>
          <div className="flex rounded-full bg-muted p-0.5 text-xs">
            <button
              onClick={() => setMode("day")}
              className={cn(
                "rounded-full px-3 py-1 font-medium transition",
                mode === "day" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              Days
            </button>
            <button
              onClick={() => setMode("month")}
              className={cn(
                "rounded-full px-3 py-1 font-medium transition",
                mode === "month" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              Months
            </button>
          </div>
        </div>
        <div className="mt-3 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: -16, right: 4, top: 4, bottom: 0 }} barGap={3} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                contentStyle={{ borderRadius: 14, border: "1px solid var(--color-border)", fontSize: 12 }}
                formatter={(v: number, n) => [formatBDT(v), n === "sales" ? "Sales" : "Profit"]}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                formatter={(v) => (v === "sales" ? "Sales" : "Profit")}
              />
              <Bar dataKey="sales" fill="var(--color-primary)" radius={[6, 6, 0, 0]} maxBarSize={14} />
              <Bar dataKey="profit" fill="var(--color-profit)" radius={[6, 6, 0, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>


      {/* Top product */}
      {data.top_product ? (
        <Link to="/products" className="mt-3 block">
          <section className="card-soft flex items-center gap-3 p-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-secondary">
              {data.top_product.photo_url ? (
                <img src={data.top_product.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Package className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Top product</p>
              <p className="truncate font-display text-lg font-bold">{data.top_product.name}</p>
              <p className="text-xs text-muted-foreground">{formatBDT(data.top_product.revenue)} revenue</p>
            </div>
            <span className="chip bg-profit/15 text-profit">
              {data.top_product.margin}% margin
            </span>
          </section>
        </Link>
      ) : null}

      {/* Reinvestment chain */}
      <section className="mt-3 card-soft p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Last 30 days</p>
            <h2 className="font-display text-lg font-bold">Reinvestment</h2>
          </div>
          <Link to="/finance" className="chip text-primary">Cash flow</Link>
        </div>
        <div className="mt-3 flex items-stretch gap-2 overflow-x-auto pb-1">
          <FlowChip label="Profit" value={data.reinvestment.profit_30d} tone="primary" />
          <FlowArrow />
          <FlowChip label="Reinvested" value={-data.reinvestment.reinvested_30d} tone="expense" />
          <FlowArrow />
          <FlowChip label="Remaining" value={data.reinvestment.remaining} tone="profit" />
        </div>
      </section>

      {/* Recent activity */}
      <section className="mt-3 grid gap-3">
        <ListCard title="Recent orders" link="/orders">
          {data.recent_orders.length === 0 ? (
            <Empty text="No orders yet — tap + to record your first sale." />
          ) : (
            data.recent_orders.map((o) => (
              <Row
                key={o.id}
                left={o.product_summary}
                sub={`${o.customer ?? "Walk-in"} · ${fmtDate(o.ordered_at)}`}
                right={formatBDT(o.total)}
                badge={o.status}
              />
            ))
          )}
        </ListCard>

        <ListCard title="Recent expenses" link="/finance">
          {data.recent_expenses.length === 0 ? (
            <Empty text="No expenses logged yet." />
          ) : (
            data.recent_expenses.map((e) => (
              <Row
                key={e.id}
                left={e.description ?? e.category ?? "Expense"}
                sub={`${e.category ?? "Uncategorized"} · ${fmtDate(e.spent_at)}`}
                right={`-${formatBDT(e.amount)}`}
                tone="expense"
              />
            ))
          )}
        </ListCard>

        <ListCard title="Recent feedback" link="/feedback">
          {data.recent_feedback.length === 0 ? (
            <Empty text="No reviews yet." />
          ) : (
            data.recent_feedback.map((f) => (
              <Row
                key={f.id}
                left={f.product ?? "Product"}
                sub={f.comment ?? `${f.customer ?? "Customer"} review`}
                right={
                  <span className="flex items-center gap-0.5 text-warn">
                    {Array.from({ length: f.rating }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </span>
                }
              />
            ))
          )}
        </ListCard>
      </section>
    </AppShell>
  );
}

function KpiHero({ label, value, tone }: { label: string; value: string; tone: "primary" | "profit" }) {
  const bg = tone === "primary" ? "bg-primary text-primary-foreground" : "bg-profit text-profit-foreground";
  return (
    <div className={`card-soft border-transparent p-4 ${bg}`}>
      <p className="text-xs uppercase tracking-wider opacity-80">{label}</p>
      <p className="num mt-1 text-3xl font-black">{value}</p>
    </div>
  );
}

function KpiMini({
  icon, label, value, link,
}: { icon: React.ReactNode; label: string; value: string; link: string }) {
  return (
    <Link to={link} className="card-soft flex items-center gap-3 p-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-secondary-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="num text-xl font-bold leading-none">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </Link>
  );
}

function FlowChip({ label, value, tone }: { label: string; value: number; tone: "primary" | "profit" | "expense" }) {
  const cls =
    tone === "primary" ? "bg-secondary text-secondary-foreground"
      : tone === "profit" ? "bg-profit/15 text-profit"
        : "bg-expense/15 text-expense";
  return (
    <div className={`min-w-[6.5rem] flex-1 rounded-2xl px-3 py-2.5 ${cls}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="num text-base font-bold">{formatBDT(value)}</p>
    </div>
  );
}
function FlowArrow() { return <div className="self-center text-muted-foreground">→</div>; }

function ListCard({ title, link, children }: { title: string; link: string; children: React.ReactNode }) {
  return (
    <section className="card-soft p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-base font-bold">{title}</h2>
        <Link to={link} className="text-xs text-primary">See all</Link>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({
  left, sub, right, badge, tone,
}: { left: React.ReactNode; sub?: React.ReactNode; right: React.ReactNode; badge?: string; tone?: "expense" }) {
  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{left}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      {badge && <span className="chip capitalize">{badge}</span>}
      <span className={`num text-sm font-semibold ${tone === "expense" ? "text-expense" : ""}`}>
        {right}
      </span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-3 text-center text-xs text-muted-foreground">{text}</p>;
}
