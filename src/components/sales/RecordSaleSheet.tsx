import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { listProducts } from "@/lib/products.functions";
import { listCustomers } from "@/lib/customers.functions";
import { createOrder } from "@/lib/orders.functions";
import { formatBDT } from "@/lib/format";
import { toast } from "sonner";

export function RecordSaleSheet({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const listProductsFn = useServerFn(listProducts);
  const listCustomersFn = useServerFn(listCustomers);
  const createOrderFn = useServerFn(createOrder);

  const products = useQuery({ queryKey: ["products"], queryFn: () => listProductsFn(), enabled: open });
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => listCustomersFn(), enabled: open });

  const [productId, setProductId] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [platform, setPlatform] = useState<"facebook" | "instagram" | "website" | "whatsapp" | "in_person" | "other">("facebook");
  const [payment, setPayment] = useState<"cash" | "bkash" | "nagad" | "bank" | "other">("bkash");
  const [shipping, setShipping] = useState(0);
  const [markShipped, setMarkShipped] = useState(false);

  useEffect(() => {
    const p = products.data?.find((x) => x.id === productId);
    if (p) setUnitPrice(Number(p.selling_price));
  }, [productId, products.data]);

  useEffect(() => {
    if (!open) {
      setProductId(""); setQty(1); setUnitPrice(0); setCustomerId(""); setCustomerName("");
      setPlatform("facebook"); setPayment("bkash"); setShipping(0); setMarkShipped(false);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof createOrderFn>[0]) => createOrderFn(input),
    onSuccess: () => {
      toast.success("Sale recorded");
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to record sale"),
  });

  const total = qty * unitPrice + Number(shipping || 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display">Record sale</SheetTitle>
          <SheetDescription>One-tap entry. Stock updates when shipped.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {(products.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {formatBDT(p.selling_price)}
                  </SelectItem>
                ))}
                {!products.data?.length && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Add a product first.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit price (৳)</Label>
              <Input type="number" min={0} value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Customer (optional)</Label>
            <Select value={customerId || "_new"} onValueChange={(v) => setCustomerId(v === "_new" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="New / select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_new">— New / no customer —</SelectItem>
                {(customers.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!customerId && (
              <Input
                placeholder="Customer name (optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["facebook", "instagram", "website", "whatsapp", "in_person", "other"].map((p) => (
                    <SelectItem key={p} value={p}>{p.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Payment</Label>
              <Select value={payment} onValueChange={(v) => setPayment(v as typeof payment)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["cash", "bkash", "nagad", "bank", "other"].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Shipping (৳)</Label>
            <Input type="number" min={0} value={shipping} onChange={(e) => setShipping(Number(e.target.value))} />
          </div>
          <label className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-3 py-2.5">
            <span className="text-sm">Mark as shipped now (deduct stock)</span>
            <Switch checked={markShipped} onCheckedChange={setMarkShipped} />
          </label>
          <div className="flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3">
            <span className="text-sm text-secondary-foreground">Total</span>
            <span className="num text-2xl font-bold">{formatBDT(total)}</span>
          </div>
          <Button
            className="h-12 w-full rounded-2xl text-base"
            disabled={!productId || mutation.isPending}
            onClick={() =>
              mutation.mutate({
                data: {
                  customer_id: customerId || undefined,
                  customer_name: customerName || undefined,
                  status: markShipped ? "shipped" : "new",
                  platform,
                  payment_method: payment,
                  shipping_cost: Number(shipping || 0),
                  items: [{ product_id: productId, qty, unit_price: unitPrice }],
                },
              })
            }
          >
            {mutation.isPending ? "Recording…" : "Record sale"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
