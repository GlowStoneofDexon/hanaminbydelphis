import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { listOverheadExpenses } from "@/lib/finance.functions";
import { Plus, Trash2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SurveyResult = {
  name: string;
  selling_price: number;
  current_stock: number;
  labor_cost: number;
  category: string;
  recipe: { material_name: string; unit_cost_override: number; qty_per_unit: number }[];
  overhead_expense_ids: string[];
};

type RecipeRow = { material_name: string; cost: string };

const STEPS = [
  { key: "name", label: "Product name", required: true, placeholder: "Rose pendant" },
  { key: "price", label: "Selling price (৳)", required: true, placeholder: "250" },
  { key: "stock", label: "Stock", required: false, placeholder: "15" },
  { key: "labor", label: "Labor cost (৳)", required: false, placeholder: "30" },
  { key: "category", label: "Category", required: false, placeholder: "Earrings" },
  { key: "recipe", label: "Materials", required: false },
  { key: "overheads", label: "Overheads used", required: false },
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
  const [category, setCategory] = useState("");
  const [recipe, setRecipe] = useState<RecipeRow[]>([]);
  const [overheadIds, setOverheadIds] = useState<string[]>([]);

  const ohFn = useServerFn(listOverheadExpenses);
  const overheads = useQuery({
    queryKey: ["overhead-expenses"],
    queryFn: () => ohFn(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setStep(0); setName(""); setPrice(""); setStock(""); setLabor("");
      setCategory(""); setRecipe([]); setOverheadIds([]);
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
      category: category.trim(),
      recipe: recipe
        .filter((r) => r.material_name.trim())
        .map((r) => ({
          material_name: r.material_name.trim(),
          unit_cost_override: Number(r.cost || 0),
          qty_per_unit: 1,
        })),
      overhead_expense_ids: overheadIds,
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

        {/* progress dots */}
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
            <Input
              autoFocus
              className="mt-2 h-12 rounded-2xl text-base"
              placeholder={cur.placeholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canNext && setStep((s) => s + 1)}
            />
          )}

          {cur.key === "price" && (
            <Input
              autoFocus
              inputMode="decimal"
              className="mt-2 h-12 rounded-2xl text-base"
              placeholder={cur.placeholder}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canNext && setStep((s) => s + 1)}
            />
          )}

          {cur.key === "stock" && (
            <Input
              autoFocus
              inputMode="numeric"
              className="mt-2 h-12 rounded-2xl text-base"
              placeholder={cur.placeholder}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          )}

          {cur.key === "labor" && (
            <Input
              autoFocus
              inputMode="decimal"
              className="mt-2 h-12 rounded-2xl text-base"
              placeholder={cur.placeholder}
              value={labor}
              onChange={(e) => setLabor(e.target.value)}
            />
          )}

          {cur.key === "category" && (
            <Input
              autoFocus
              className="mt-2 h-12 rounded-2xl text-base"
              placeholder={cur.placeholder}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          )}

          {cur.key === "recipe" && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-muted-foreground">
                Add each material with its cost per unit (৳).
              </p>
              {recipe.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_5.5rem_2rem] items-center gap-2">
                  <Input
                    className="h-10 rounded-xl"
                    placeholder="Resin"
                    value={r.material_name}
                    onChange={(e) =>
                      setRecipe((rs) => rs.map((x, j) => (j === i ? { ...x, material_name: e.target.value } : x)))
                    }
                  />
                  <Input
                    className="h-10 rounded-xl"
                    inputMode="decimal"
                    placeholder="৳ 0"
                    value={r.cost}
                    onChange={(e) =>
                      setRecipe((rs) => rs.map((x, j) => (j === i ? { ...x, cost: e.target.value } : x)))
                    }
                  />
                  <button
                    onClick={() => setRecipe((rs) => rs.filter((_, j) => j !== i))}
                    className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full"
                onClick={() => setRecipe((rs) => [...rs, { material_name: "", cost: "" }])}
              >
                <Plus className="h-4 w-4" /> Add material
              </Button>
            </div>
          )}

          {cur.key === "overheads" && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-muted-foreground">
                Each overhead is split across {`{N}`} uses (set in Finance, default 50).
              </p>
              {(overheads.data ?? []).length === 0 && (
                <p className="rounded-2xl bg-muted/40 p-3 text-center text-xs text-muted-foreground">
                  No overhead expenses yet. Mark an expense as "Use as overhead" in Finance to see it here.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {(overheads.data ?? []).map((o: any) => {
                  const on = overheadIds.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() =>
                        setOverheadIds((ids) =>
                          on ? ids.filter((x) => x !== o.id) : [...ids, o.id],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition",
                        on
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-foreground hover:bg-muted",
                      )}
                    >
                      {on && <Check className="mr-1 inline h-3 w-3" />}
                      {o.label} · {formatBDT(o.per_unit)}/unit
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-2">
          <Button
            variant="ghost"
            className="rounded-full"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {!cur.required && !isLast && (
            <Button
              variant="ghost"
              className="rounded-full text-muted-foreground"
              onClick={() => setStep((s) => s + 1)}
            >
              Skip
            </Button>
          )}
          <Button
            className="ml-auto h-11 rounded-2xl px-5"
            disabled={!canNext}
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
          >
            {isLast ? "Continue" : "Next"} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
