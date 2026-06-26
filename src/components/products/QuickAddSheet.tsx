import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { quickCreateProduct } from "@/lib/quick-add.functions";

const EXAMPLES = [
  "Earring -150tk, 77 in stock. Mostly resin used for 99tk, 10tk of nickel, 41tk of color",
  "Rose pendant, 250 taka, 12 stock, resin 60tk, dried flower 30tk, hook 5tk",
];

export function QuickAddSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: (productId: string) => void;
}) {
  const [text, setText] = useState("");
  const qc = useQueryClient();
  const fn = useServerFn(quickCreateProduct);

  const create = useMutation({
    mutationFn: () => fn({ data: { text } }),
    onSuccess: (r) => {
      toast.success(`Draft created — review & save`, {
        description: `"${r.parsed.name}" · ${r.parsed.materials.length} materials linked.`,
      });
      qc.invalidateQueries();
      setText("");
      onOpenChange(false);
      onCreated?.(r.product_id);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create product"),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Describe your product
          </SheetTitle>
          <SheetDescription>
            One line — name, price, stock, materials. AI fills the rest, then you review.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-3 space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='e.g. "Earring -150tk, 77 in stock. Resin 99tk, nickel 10tk, color 41tk"'
            className="min-h-28 rounded-2xl text-base"
            autoFocus
          />

          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Tap an example:</p>
            <div className="space-y-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setText(ex)}
                  className="w-full rounded-2xl bg-secondary/60 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-secondary"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="h-11 w-full rounded-2xl"
            disabled={text.trim().length < 3 || create.isPending}
            onClick={() => create.mutate()}
          >
            <Sparkles className="h-4 w-4" />
            {create.isPending ? "Thinking…" : "Continue"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
