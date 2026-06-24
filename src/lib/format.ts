export function formatBDT(n: number | null | undefined, opts: { compact?: boolean; sign?: boolean } = {}): string {
  const v = Number(n ?? 0);
  const sign = opts.sign && v > 0 ? "+" : "";
  if (opts.compact && Math.abs(v) >= 1000) {
    return `${sign}৳${new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;
  }
  return `${sign}৳${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(v)}`;
}

export function formatNum(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n ?? 0));
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "Good Night";
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  if (h < 21) return "Good Evening";
  return "Good Night";
}

export function fmtDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
}

export function fmtDateTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}
