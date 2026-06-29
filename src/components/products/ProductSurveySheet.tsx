import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type SurveyResult = {
  name: string;
  selling_price: number;
  current_stock: number;
  labor_cost: number;
  overhead_cost: number;
  category: string;
  recipe: { material_name: string; unit_cost_override: number; qty_per_unit: number }[];
};

type RecipeRow = { material_name: string; cost: string };

const STEPS = [
  { key: "name", label: "Product name", required: true, placeholder: "Rose pendant" },
  { key: "price", label: "Selling price (৳)", required: true, placeholder: "250" },
  { key: "stock", label: "Stock", required: false, placeholder: "15" },
  { key: "labor", label: "Labor cost (৳)", required: false, placeholder: "30" },
  { key: "overhead", label: "Overhead cost (৳)", required: false, placeholder: "20" },
  { key: "category", label: "Category", required: false, placeholder: "Earrings" },
  { key: "recipe", label: "Materials", required: false },
] as const;

export function ProductSurveySheet({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onComplete: (r: SurveyResult) => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [labor, setLabor] = useState("");
  const [overhead, setOverhead] = useState("");
  const [category, setCategory] = useState("");
  const [recipe, setRecipe] = useState<RecipeRow[]>([]);

  useEffect(() => {
    if (!open) {
      setStep(0); setName(""); setPrice(""); setStock(""); setLabor("");
      setOverhead(""); setCategory(""); setRecipe([]);
    }
  }, [open]);

  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const canNext = (() => {
    if (cur.key === "name") return name.trim().length > 0;
    if (cur.key === "price") return Number(price) > 0;
    return true;
  })();

  const finish = () => {
    onComplete({
      name: name.trim(),
      selling_price: Number(price || 0),
      current_stock: Number(stock || 0),
      labor_cost: Number(labor || 0),
      overhead_cost: Number(overhead || 0),
      category: category.trim(),
      recipe: recipe
        .filter((r) => r.material_name.trim())
        .map((r) => ({
          material_name: r.material_name.trim(),
          unit_cost_override: Number(r.cost || 0),
          qty_per_unit: 1,
        })),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[78vh] overflow-y-auto rounded-t-3xl p-5 pb-7">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted" />
        <SheetHeader className="space-y-1">
          <SheetTitle className="font-display text-lg">New product</SheetTitle>
          <SheetDescription className="text-xs">
            Step {step + 1} of {STEPS.length} · {cur.required ? "required" : "skippable"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-3 flex gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition",
                i < step ? "bg-primary" : i === step ? "bg-primary/70" : "bg-muted",
              )}
            />
          ))}
        </div>

        <div className="mt-5 min-h-40">
          <Label className="text-sm font-medium">{cur.label}</Label>

          {cur.key === "name" && (
            <Input autoFocus className="mt-2 h-12 rounded-2xl text-base" placeholder={cur.placeholder}
              value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canNext && setStep((s) => s + 1)} />
          )}
          {cur.key === "price" && (
            <Input autoFocus inputMode="decimal" className="mt-2 h-12 rounded-2xl text-base" placeholder={cur.placeholder}
              value={price} onChange={(e) => setPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canNext && setStep((s) => s + 1)} />
          )}
          {cur.key === "stock" && (
            <Input autoFocus inputMode="numeric" className="mt-2 h-12 rounded-2xl text-base" placeholder={cur.placeholder}
              value={stock} onChange={(e) => setStock(e.target.value)} />
          )}
          {cur.key === "labor" && (
            <Input autoFocus inputMode="decimal" className="mt-2 h-12 rounded-2xl text-base" placeholder={cur.placeholder}
              value={labor} onChange={(e) => setLabor(e.target.value)} />
          )}
          {cur.key === "overhead" && (
            <>
              <Input autoFocus inputMode="decimal" className="mt-2 h-12 rounded-2xl text-base" placeholder={cur.placeholder}
                value={overhead} onChange={(e) => setOverhead(e.target.value)} />
              <p className="mt-2 text-xs text-muted-foreground">
                Packaging, electricity, sticker, etc. — per unit.
              </p>
            </>
          )}
          {cur.key === "category" && (
            <Input autoFocus className="mt-2 h-12 rounded-2xl text-base" placeholder={cur.placeholder}
              value={category} onChange={(e) => setCategory(e.target.value)} />
          )}

          {cur.key === "recipe" && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-muted-foreground">
                Add each material with its cost per unit (৳).
              </p>
              {recipe.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_5.5rem_2rem] items-center gap-2">
                  <Input className="h-10 rounded-xl" placeholder="Resin" value={r.material_name}
                    onChange={(e) => setRecipe((rs) => rs.map((x, j) => j === i ? { ...x, material_name: e.target.value } : x))} />
                  <Input className="h-10 rounded-xl" inputMode="decimal" placeholder="৳ 0" value={r.cost}
                    onChange={(e) => setRecipe((rs) => rs.map((x, j) => j === i ? { ...x, cost: e.target.value } : x))} />
                  <button onClick={() => setRecipe((rs) => rs.filter((_, j) => j !== i))}
                    className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button variant="secondary" size="sm" className="rounded-full"
                onClick={() => setRecipe((rs) => [...rs, { material_name: "", cost: "" }])}>
                <Plus className="h-4 w-4" /> Add material
              </Button>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <Button variant="ghost" className="rounded-full" disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex gap-2">
            {!cur.required && !isLast && (
              <Button variant="secondary" className="rounded-full"
                onClick={() => setStep((s) => s + 1)}>
                Skip
              </Button>
            )}
            {isLast ? (
              <Button className="rounded-full" onClick={finish} disabled={!canNext}>
                <Check className="h-4 w-4" /> Continue
              </Button>
            ) : (
              <Button className="rounded-full" disabled={!canNext}
                onClick={() => setStep((s) => s + 1)}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
