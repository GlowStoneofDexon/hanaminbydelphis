import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { listProducts, upsertProduct, deleteProduct, getProduct, type ProductWithCost } from "@/lib/products.functions";
import { formatBDT } from "@/lib/format";
import { Plus, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProductSurveySheet, type SurveyResult } from "@/components/products/ProductSurveySheet";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [{ title: "Products — Hanami" }] }),
  component: ProductsPage,
});

type RecipeRow = { material_name: string; cost: string; qty: string };
type Prefill = {
  name?: string;
  category?: string;
  selling_price?: string;
  current_stock?: string;
  labor_cost?: string;
  overhead_cost?: string;
  recipe?: RecipeRow[];
};

function ProductsPage() {
  const fn = useServerFn(listProducts);
  const { data } = useSuspenseQuery({ queryKey: ["products"], queryFn: () => fn() });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  const onSurveyComplete = (r: SurveyResult) => {
    setSurveyOpen(false);
    setEditingId(null);
    setPrefill({
      name: r.name,
      category: r.category,
      selling_price: r.selling_price ? String(r.selling_price) : "",
      current_stock: r.current_stock ? String(r.current_stock) : "",
      labor_cost: r.labor_cost ? String(r.labor_cost) : "",
      overhead_cost: r.overhead_cost ? String(r.overhead_cost) : "",
      recipe: r.recipe.map((m) => ({
        material_name: m.material_name,
        cost: String(m.unit_cost_override),
        qty: String(m.qty_per_unit),
      })),
    });
    setOpen(true);
  };

  return (
    <AppShell
      title="Products"
      subtitle="Your catalog"
      right={
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full"
            onClick={() => { setEditingId(null); setPrefill(null); setOpen(true); }}
          >
            Manual
          </Button>
          <Button size="sm" className="rounded-full" onClick={() => setSurveyOpen(true)}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      }
    >
      {data.length === 0 ? (
        <EmptyState onAdd={() => setSurveyOpen(true)} />
      ) : (
        <div className="grid gap-3">
          {data.map((p) => (
            <button
              key={p.id}
              onClick={() => { setEditingId(p.id); setPrefill(null); setOpen(true); }}
              className="card-soft flex items-center gap-3 p-3 text-left"
            >
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-secondary">
                {p.photo_url ? <img src={p.photo_url} className="h-full w-full object-cover" alt="" />
                  : <Package className="h-6 w-6 text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-bold">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  Cost {formatBDT(p.unit_cost)} · Price {formatBDT(p.selling_price)}
                </p>
                <p className="mt-0.5 text-xs">
                  <span className="text-profit font-medium">{formatBDT(p.profit, { sign: true })}</span>
                  <span className="text-muted-foreground"> · {Math.round(p.margin)}% margin · {p.current_stock} in stock</span>
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && (
        <ProductSheet
          open={open}
          onOpenChange={(o) => { setOpen(o); if (!o) setPrefill(null); }}
          editingId={editingId}
          prefill={prefill}
        />
      )}
      <ProductSurveySheet
        open={surveyOpen}
        onOpenChange={setSurveyOpen}
        onComplete={onSurveyComplete}
      />
    </AppShell>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card-soft mt-4 p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary">
        <Package className="h-6 w-6 text-primary" />
      </div>
      <h3 className="mt-3 font-display text-lg font-bold">Add your first product</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Define a recipe so we can auto-calculate cost and profit.
      </p>
      <Button className="mt-4 rounded-full" onClick={onAdd}><Plus className="h-4 w-4" /> Add product</Button>
    </div>
  );
}

function ProductSheet({
  open, onOpenChange, editingId, prefill,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editingId: string | null;
  prefill: Prefill | null;
}) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertProduct);
  const del = useServerFn(deleteProduct);
  const getFn = useServerFn(getProduct);
  const ohFn = useServerFn(listOverheadExpenses);

  const overheads = useQuery({ queryKey: ["overhead-expenses"], queryFn: () => ohFn(), enabled: open });

  const [name, setName] = useState(prefill?.name ?? "");
  const [category, setCategory] = useState(prefill?.category ?? "");
  const [photo, setPhoto] = useState("");
  const [price, setPrice] = useState<string>(prefill?.selling_price ?? "");
  const [stock, setStock] = useState<string>(prefill?.current_stock ?? "");
  const [labor, setLabor] = useState<string>(prefill?.labor_cost ?? "");
  const [overhead, setOverhead] = useState<string>("");
  const [recipe, setRecipe] = useState<RecipeRow[]>(prefill?.recipe ?? []);
  const [overheadIds, setOverheadIds] = useState<string[]>(prefill?.overhead_expense_ids ?? []);

  // load existing product
  useQuery({
    queryKey: ["product-full", editingId],
    queryFn: async () => {
      if (!editingId) return null;
      const data: any = await getFn({ data: { id: editingId } });
      if (data) {
        setName(data.name ?? "");
        setCategory(data.category ?? "");
        setPhoto(data.photo_url ?? "");
        setPrice(data.selling_price ? String(data.selling_price) : "");
        setStock(data.current_stock != null ? String(data.current_stock) : "");
        setLabor(data.labor_cost ? String(data.labor_cost) : "");
        setOverhead(data.overhead_cost ? String(data.overhead_cost) : "");
        setRecipe(
          (data.recipe ?? []).map((r: any) => ({
            material_name: r.material_name ?? r.materials?.name ?? "",
            cost: String(r.unit_cost_override ?? r.materials?.avg_unit_cost ?? 0),
            qty: String(r.qty_per_unit ?? 1),
          })),
        );
        setOverheadIds(data.overhead_expense_ids ?? []);
      }
      return data;
    },
    enabled: open && !!editingId,
    staleTime: 0,
  });

  // amortized overhead preview
  const amortized = overheadIds.reduce((s, id) => {
    const o = overheads.data?.find((x: any) => x.id === id);
    return s + Number(o?.per_unit ?? 0);
  }, 0);
  const matCost = recipe.reduce(
    (s, r) => s + Number(r.cost || 0) * Number(r.qty || 1),
    0,
  );
  const unitCost = matCost + Number(labor || 0) + Number(overhead || 0) + amortized;
  const profit = Number(price || 0) - unitCost;
  const margin = Number(price || 0) > 0 ? (profit / Number(price)) * 100 : 0;

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: editingId ?? undefined,
          name,
          category: category || null,
          photo_url: photo || null,
          selling_price: Number(price || 0),
          current_stock: Number(stock || 0),
          labor_cost: Number(labor || 0),
          overhead_cost: Number(overhead || 0),
          recipe: recipe
            .filter((r) => r.material_name.trim())
            .map((r) => ({
              material_name: r.material_name.trim(),
              unit_cost_override: Number(r.cost || 0),
              qty_per_unit: Number(r.qty || 1),
            })),
          overhead_expense_ids: overheadIds,
        },
      }),
    onSuccess: () => {
      toast.success(editingId ? "Product updated" : "Product added");
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const remove = useMutation({
    mutationFn: () => del({ data: { id: editingId! } }),
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries();
      onOpenChange(false);
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[72vh] overflow-y-auto rounded-t-3xl p-4 pb-6">
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-muted" />
        <SheetHeader className="space-y-0.5">
          <SheetTitle className="font-display text-base">{editingId ? "Edit product" : "New product"}</SheetTitle>
          <SheetDescription className="text-xs">Review &amp; save. Cost updates as you type.</SheetDescription>
        </SheetHeader>

        <div className="mt-3 space-y-2.5">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input className="h-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rose pendant" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Category" v={category} set={setCategory} placeholder="Earrings" />
            <Field label="Photo URL" v={photo} set={setPhoto} placeholder="https://…" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Selling price (৳)" v={price} set={setPrice} placeholder="250" />
            <NumField label="Stock" v={stock} set={setStock} placeholder="15" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Labor (৳)" v={labor} set={setLabor} placeholder="30" />
            <NumField label="Extra overhead (৳)" v={overhead} set={setOverhead} placeholder="0" />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="text-xs">Recipe — write material name &amp; cost</Label>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 rounded-full px-2 text-xs"
                onClick={() => setRecipe((r) => [...r, { material_name: "", cost: "", qty: "1" }])}
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {recipe.length === 0 && (
              <p className="rounded-2xl bg-muted/40 p-2.5 text-center text-xs text-muted-foreground">
                No materials yet.
              </p>
            )}
            <div className="space-y-1.5">
              {recipe.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_4.5rem_4rem_2rem] items-center gap-1.5">
                  <Input
                    className="h-9"
                    placeholder="Resin"
                    value={r.material_name}
                    onChange={(e) => setRecipe((rs) => rs.map((x, j) => j === i ? { ...x, material_name: e.target.value } : x))}
                  />
                  <Input
                    className="h-9"
                    inputMode="decimal"
                    placeholder="৳ 0"
                    value={r.cost}
                    onChange={(e) => setRecipe((rs) => rs.map((x, j) => j === i ? { ...x, cost: e.target.value } : x))}
                  />
                  <Input
                    className="h-9"
                    inputMode="decimal"
                    placeholder="qty 1"
                    value={r.qty}
                    onChange={(e) => setRecipe((rs) => rs.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))}
                  />
                  <button
                    onClick={() => setRecipe((rs) => rs.filter((_, j) => j !== i))}
                    className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Overheads used (auto-spread)</Label>
            {(overheads.data ?? []).length === 0 ? (
              <p className="mt-1 rounded-2xl bg-muted/40 p-2.5 text-center text-xs text-muted-foreground">
                Mark expenses as overhead in Finance to use them here.
              </p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(overheads.data ?? []).map((o: any) => {
                  const on = overheadIds.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() =>
                        setOverheadIds((ids) => on ? ids.filter((x) => x !== o.id) : [...ids, o.id])
                      }
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition",
                        on ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
                      )}
                    >
                      {on && <Check className="mr-1 inline h-3 w-3" />}
                      {o.label} · {formatBDT(o.per_unit)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-secondary/60 p-3">
            <Stat label="Unit cost" value={formatBDT(unitCost)} />
            <Stat label="Profit" value={formatBDT(profit)} tone={profit >= 0 ? "profit" : "expense"} />
            <Stat label="Margin" value={`${Math.round(margin)}%`} />
          </div>

          <div className="flex gap-2 pt-1">
            {editingId && (
              <Button variant="outline" className="rounded-2xl" onClick={() => remove.mutate()}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
            <Button
              className="ml-auto h-11 rounded-2xl px-6"
              disabled={!name || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, v, set, placeholder }: { label: string; v: string; set: (s: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input className="h-9" value={v} onChange={(e) => set(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function NumField({ label, v, set, placeholder }: { label: string; v: string; set: (s: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        className="h-9"
        type="number"
        inputMode="decimal"
        value={v}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "profit" | "expense" }) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`num text-base font-bold ${tone === "profit" ? "text-profit" : tone === "expense" ? "text-expense" : ""}`}>
        {value}
      </p>
    </div>
  );
}
// satisfy unused import linters if any
void useEffect;
