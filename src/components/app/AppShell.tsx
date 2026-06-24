import { type ReactNode, useState } from "react";
import { BottomNav } from "./BottomNav";
import { RecordSaleSheet } from "@/components/sales/RecordSaleSheet";

export function AppShell({
  title, subtitle, right, children,
}: { title?: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  const [recordOpen, setRecordOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-md px-4 pb-32 pt-5">
        {(title || right) && (
          <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              {subtitle && (
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {subtitle}
                </p>
              )}
              {title && (
                <h1 className="truncate font-display text-2xl font-bold">{title}</h1>
              )}
            </div>
            {right && <div className="shrink-0">{right}</div>}
          </header>
        )}
        {children}
      </div>
      <BottomNav onFab={() => setRecordOpen(true)} />
      <RecordSaleSheet open={recordOpen} onOpenChange={setRecordOpen} />
    </div>
  );
}
