import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listFeedback, createFeedback, deleteFeedback } from "@/lib/feedback.functions";
import { listProducts } from "@/lib/products.functions";
import { listCustomers } from "@/lib/customers.functions";
import { fmtDate } from "@/lib/format";
import { Star, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/feedback")({
  head: () => ({ meta: [{ title: "Feedback — Hanami" }] }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const fn = useServerFn(listFeedback);
  const { data } = useSuspenseQuery({ queryKey: ["feedback"], queryFn: () => fn() });
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const delFn = useServerFn(deleteFeedback);
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feedback"] }); toast.success("Deleted"); },
  });

  return (
    <AppShell title="Feedback" subtitle="What buyers say"
      right={<Button size="sm" className="rounded-full" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New</Button>}
    >
      {data.list.length > 0 && (
        <div className="card-soft mb-3 flex items-center justify-between p-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Average rating</p>
            <p className="font-display text-3xl font-black">{data.avg.toFixed(1)}</p>
          </div>
          <Stars n={Math.round(data.avg)} size={6} />
        </div>
      )}
      {data.list.length === 0 ? (
        <div className="card-soft mt-4 p-8 text-center text-sm text-muted-foreground">
          No reviews yet. Add a star review from a customer.
        </div>
      ) : (
        <div className="grid gap-3">
          {data.list.map((f: any) => (
            <article key={f.id} className="card-soft p-4">
              <div className="flex items-center justify-between">
                <Stars n={f.rating} />
                <button onClick={() => remove.mutate(f.id)} className="text-muted-foreground hover:text-foreground">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {f.comment && <p className="mt-2 text-sm">{f.comment}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                {f.products?.name ?? "Product"} · {f.customers?.name ?? "Anonymous"} · {fmtDate(f.created_at)}
              </p>
            </article>
          ))}
        </div>
      )}
      <FeedbackSheet open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}

function Stars({ n, size = 4 }: { n: number; size?: number }) {
  const cls = `h-${size} w-${size}`;
  return (
    <span className="flex items-center gap-0.5 text-warn">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${cls} ${i < n ? "fill-current" : "opacity-30"}`} />
      ))}
    </span>
  );
}

function FeedbackSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const create = useServerFn(createFeedback);
  const productsFn = useServerFn(listProducts);
  const customersFn = useServerFn(listCustomers);
  const products = useQuery({ queryKey: ["products"], queryFn: () => productsFn(), enabled: open });
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => customersFn(), enabled: open });
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [productId, setProductId] = useState("");
  const [customerId, setCustomerId] = useState("");

  const mutate = useMutation({
    mutationFn: () => create({
      data: {
        rating, comment: comment || null,
        product_id: productId || undefined,
        customer_id: customerId || undefined,
      },
    }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries(); onOpenChange(false); setRating(5); setComment(""); setProductId(""); setCustomerId(""); },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display">New review</SheetTitle>
          <SheetDescription>Big stars, kind words.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="flex justify-center gap-2 py-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                <Star className={`h-9 w-9 ${n <= rating ? "fill-warn text-warn" : "text-warn/30"}`} />
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Comment</Label>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Loved the colors!" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={productId || "_none"} onValueChange={(v) => setProductId(v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {(products.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select value={customerId || "_none"} onValueChange={(v) => setCustomerId(v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {(customers.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="h-11 w-full rounded-2xl" disabled={mutate.isPending} onClick={() => mutate.mutate()}>
            {mutate.isPending ? "Saving…" : "Add review"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
