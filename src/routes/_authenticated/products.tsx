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
import { listProducts, upsertProduct, deleteProduct, type ProductWithCost } from "@/lib/products.functions";
import { listMaterials } from "@/lib/inventory.functions";
import { formatBDT } from "@/lib/format";
import { Plus, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { QuickAddSheet } from "@/components/products/QuickAddSheet";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [{ title: "Products — Hanami" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const fn = useServerFn(listProducts);
  const { data } = useSuspenseQuery({ queryKey: ["products"], queryFn: () => fn() });
  const [editing, setEditing] = useState<ProductWithCost | null>(null);
  const [open, setOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  return (
    <AppShell
      title="Products"
      subtitle="Your catalog"
      right={
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" className="rounded-full" onClick={() => { setEditing(null); setOpen(true); }}>
            Manual
          </Button>
          <Button size="sm" className="rounded-full" onClick={() => setQuickOpen(true)}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      }
    >
      {data.length === 0 ? (
        <EmptyState onAdd={() => setQuickOpen(true)} />
      ) : (
        <div className="grid gap-3">
          {data.map((p) => (
            <button
              key={p.id}
              onClick={() => { setEditing(p); setOpen(true); }}
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
      <ProductSheet open={open} onOpenChange={setOpen} editing={editing} />
      <QuickAddSheet
        open={quickOpen}
        onOpenChange={setQuickOpen}
        onCreated={(id) => {
          setEditing({ id } as ProductWithCost);
          setOpen(true);
        }}
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

type RecipeRow = { material_id: string; qty_per_unit: number };

function ProductSheet({
  open, onOpenChange, editing,
}: { open: boolean; onOpenChange: (o: boolean) => void; editing: ProductWithCost | null }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertProduct);
  const del = useServerFn(deleteProduct);
  const matsFn = useServerFn(listMaterials);
  const mats = useQuery({ queryKey: ["materials"], queryFn: () => matsFn(), enabled: open });

  const [name, setName] = useState(editing?.name ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [photo, setPhoto] = useState(editing?.photo_url ?? "");
  const [price, setPrice] = useState<number>(editing?.selling_price ?? 0);
  const [stock, setStock] = useState<number>(editing?.current_stock ?? 0);
  const [labor, setLabor] = useState<number>(editing?.labor_cost ?? 0);
  const [overhead, setOverhead] = useState<number>(editing?.overhead_cost ?? 0);
  const [recipe, setRecipe] = useState<RecipeRow[]>([]);

  // load full recipe when editing
  useQuery({
    queryKey: ["product-full", editing?.id ?? "new", open],
    queryFn: async () => {
      if (!editing?.id) return null;
      const mod = await import("@/lib/products.functions");
      const getProduct = mod.getProduct;
      const data = (await getProduct({ data: { id: editing.id } })) as any;
      if (data) {
        setName(data.name); setCategory(data.category ?? "");
        setPhoto(data.photo_url ?? ""); setPrice(Number(data.selling_price));
        setStock(Number(data.current_stock)); setLabor(Number(data.labor_cost));
        setOverhead(Number(data.overhead_cost));
        setRecipe((data.recipe ?? []).map((r: any) => ({
          material_id: r.material_id,
          qty_per_unit: Number(r.qty_per_unit),
        })));
      }
      return data;
    },
    enabled: open && !!editing?.id,
  });

  // reset on close
  if (!open && (name || recipe.length)) {
    // noop — let parent control
  }

  const matCost = recipe.reduce((s, r) => {
    const m = mats.data?.find((x: any) => x.id === r.material_id);
    return s + Number(r.qty_per_unit) * Number(m?.avg_unit_cost ?? 0);
  }, 0);
  const unitCost = matCost + Number(labor) + Number(overhead);
  const profit = Number(price) - unitCost;
  const margin = price > 0 ? (profit / Number(price)) * 100 : 0;

  const save = useMutation({
    mutationFn: () => upsert({
      data: {
        id: editing?.id,
        name, category: category || null, photo_url: photo || null,
        selling_price: Number(price), current_stock: Number(stock),
        labor_cost: Number(labor), overhead_cost: Number(overhead),
        recipe,
      },
    }),
    onSuccess: () => {
      toast.success(editing ? "Product updated" : "Product added");
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const remove = useMutation({
    mutationFn: () => del({ data: { id: editing!.id } }),
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries();
      onOpenChange(false);
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display">{editing ? "Edit product" : "New product"}</SheetTitle>
          <SheetDescription>Recipe builds cost automatically.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rose pendant" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Earrings" />
            </div>
            <div className="space-y-1.5">
              <Label>Photo URL</Label>
              <Input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Selling price (৳)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Stock</Label>
              <Input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Labor (৳)</Label>
              <Input type="number" value={labor} onChange={(e) => setLabor(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Overhead (৳)</Label>
              <Input type="number" value={overhead} onChange={(e) => setOverhead(Number(e.target.value))} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Recipe (materials used per unit)</Label>
              <Button size="sm" variant="secondary" className="rounded-full"
                onClick={() => setRecipe((r) => [...r, { material_id: "", qty_per_unit: 0 }])}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {recipe.length === 0 && (
              <p className="rounded-2xl bg-muted/40 p-3 text-center text-xs text-muted-foreground">
                No materials yet. Add materials in Inventory first.
              </p>
            )}
            <div className="space-y-2">
              {recipe.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_5rem_2rem] items-center gap-2">
                  <Select value={r.material_id}
                    onValueChange={(v) => setRecipe((rs) => rs.map((x, j) => j === i ? { ...x, material_id: v } : x))}>
                    <SelectTrigger><SelectValue placeholder="Select material" /></SelectTrigger>
                    <SelectContent>
                      {(mats.data ?? []).map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" value={r.qty_per_unit}
                    onChange={(e) => setRecipe((rs) => rs.map((x, j) => j === i ? { ...x, qty_per_unit: Number(e.target.value) } : x))} />
                  <button onClick={() => setRecipe((rs) => rs.filter((_, j) => j !== i))}
                    className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-secondary/60 p-3">
            <Stat label="Unit cost" value={formatBDT(unitCost)} />
            <Stat label="Profit" value={formatBDT(profit)} tone={profit >= 0 ? "profit" : "expense"} />
            <Stat label="Margin" value={`${Math.round(margin)}%`} />
          </div>

          <div className="flex gap-2 pt-2">
            {editing && (
              <Button variant="outline" className="rounded-2xl" onClick={() => remove.mutate()}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
            <Button className="ml-auto h-11 rounded-2xl px-6" disabled={!name || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
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
