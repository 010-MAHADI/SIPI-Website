import { useEffect, useState } from "react";
import { ChevronRight, Download, FileText, Package, Printer, Receipt, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  buildA4Invoice,
  buildPackingSlip,
  buildShippingLabel,
  buildThermalReceipt,
  downloadDoc,
  openDocWindow,
  type ReceiptOrder,
  type SenderDetails,
} from "@/lib/receiptUtils";

interface ReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  order: ReceiptOrder | null;
  shopName: string;
  shopId?: number;
  defaultSender?: SenderDetails;
}

type ReceiptDocType = "thermal" | "invoice" | "label" | "packing";

const DOCS: Array<{
  key: ReceiptDocType;
  icon: typeof Receipt;
  label: string;
  description: string;
  colorClass: string;
}> = [
  { key: "thermal", icon: Printer, label: "Thermal Receipt", description: "80mm POS receipt", colorClass: "bg-slate-100 text-slate-700" },
  { key: "invoice", icon: FileText, label: "A4 Invoice", description: "Professional invoice", colorClass: "bg-blue-100 text-blue-700" },
  { key: "label", icon: Truck, label: "Shipping Label", description: "Courier label", colorClass: "bg-indigo-100 text-indigo-700" },
  { key: "packing", icon: Package, label: "Packing Slip", description: "Warehouse checklist", colorClass: "bg-amber-100 text-amber-700" },
];

const getSenderStorageKey = (shopId?: number) => `flypick-sender-${shopId ?? "default"}`;

function loadSender(shopId?: number): SenderDetails {
  if (typeof window === "undefined") {
    return { name: "", phone: "", address: "", email: "" };
  }

  try {
    const raw = window.localStorage.getItem(getSenderStorageKey(shopId));
    return raw ? { name: "", phone: "", address: "", email: "", ...JSON.parse(raw) } : { name: "", phone: "", address: "", email: "" };
  } catch {
    return { name: "", phone: "", address: "", email: "" };
  }
}

function saveSender(shopId: number | undefined, sender: SenderDetails) {
  window.localStorage.setItem(getSenderStorageKey(shopId), JSON.stringify(sender));
}

export function ReceiptDialog({ open, onClose, order, shopName, shopId, defaultSender }: ReceiptDialogProps) {
  const [step, setStep] = useState<"pick" | "label-details">("pick");
  const [sender, setSender] = useState<SenderDetails>({ name: "", phone: "", address: "", email: "" });
  const [receiver, setReceiver] = useState({ name: "", phone: "", address: "" });

  useEffect(() => {
    if (!open) {
      setStep("pick");
      return;
    }

    const savedSender = loadSender(shopId);
    setSender({
      name: defaultSender?.name || savedSender.name || shopName || "",
      phone: defaultSender?.phone || savedSender.phone || "",
      address: defaultSender?.address || savedSender.address || "",
      email: defaultSender?.email || savedSender.email || "",
    });

    if (!order) {
      setReceiver({ name: "", phone: "", address: "" });
      return;
    }

    const lines = [
      order.address.street,
      [order.address.city, order.address.state, order.address.zip].filter(Boolean).join(", "),
      order.address.country,
    ].filter(Boolean);

    setReceiver({
      name: order.customer,
      phone: order.phone,
      address: lines.join("\n"),
    });
  }, [defaultSender, open, order, shopId, shopName]);

  if (!order) {
    return null;
  }

  const handleClose = () => {
    setStep("pick");
    onClose();
  };

  const generate = (type: ReceiptDocType, action: "print" | "download") => {
    let html = "";

    switch (type) {
      case "thermal":
        html = buildThermalReceipt(order, shopName, sender);
        break;
      case "invoice":
        html = buildA4Invoice(order, shopName, sender);
        break;
      case "label":
        html = buildShippingLabel(order, shopName, sender, receiver);
        break;
      case "packing":
        html = buildPackingSlip(order, shopName, sender);
        break;
    }

    const label = DOCS.find((doc) => doc.key === type)?.label || "Document";

    if (action === "print") {
      openDocWindow(html);
      toast.success(`${label} opened for printing`);
    } else {
      downloadDoc(html, `${order.id}-${type}.html`);
      toast.success(`${label} downloaded`);
    }

    handleClose();
  };

  const handleLabelAction = (action: "print" | "download") => {
    if (!sender.name.trim() || !sender.address.trim()) {
      toast.error("Sender name and address are required");
      return;
    }
    if (!receiver.name.trim() || !receiver.address.trim()) {
      toast.error("Receiver name and address are required");
      return;
    }

    saveSender(shopId, sender);
    generate("label", action);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        {step === "pick" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Print or Download Documents
              </DialogTitle>
              <DialogDescription>
                Order <span className="font-mono font-semibold text-foreground">{order.id}</span> / {order.customer}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 py-2">
              {DOCS.map((doc) => (
                <button
                  key={doc.key}
                  type="button"
                  onClick={() => (doc.key === "label" ? setStep("label-details") : generate(doc.key, "print"))}
                  className="group flex flex-col items-start gap-2 rounded-xl border-2 border-border p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5"
                >
                  <div className={`rounded-lg p-2 transition-transform group-hover:scale-110 ${doc.colorClass}`}>
                    <doc.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold">{doc.label}</p>
                    <p className="text-[11px] text-muted-foreground">{doc.description}</p>
                  </div>
                  <ChevronRight className="ml-auto mt-auto h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                </button>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" className="w-full sm:w-auto" onClick={handleClose}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Shipping Label Details
              </DialogTitle>
              <DialogDescription>Fill in sender and receiver details for the shipping label.</DialogDescription>
            </DialogHeader>

            <div className="max-h-[60vh] space-y-4 overflow-y-auto py-1">
              <section>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Sender / Return Address</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px]">Name <span className="text-destructive">*</span></Label>
                      <Input className="h-9 rounded-lg text-sm" value={sender.name} onChange={(event) => setSender((current) => ({ ...current, name: event.target.value }))} placeholder="Shop or sender name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px]">Phone</Label>
                      <Input className="h-9 rounded-lg text-sm" value={sender.phone} onChange={(event) => setSender((current) => ({ ...current, phone: event.target.value }))} placeholder="+1 555 000 0000" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Address <span className="text-destructive">*</span></Label>
                    <Textarea className="min-h-[72px] resize-none rounded-lg text-sm" value={sender.address} onChange={(event) => setSender((current) => ({ ...current, address: event.target.value }))} placeholder="Full sender address" />
                  </div>
                </div>
              </section>

              <Separator />

              <section>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Delivery / Receiver Address</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px]">Name <span className="text-destructive">*</span></Label>
                      <Input className="h-9 rounded-lg text-sm" value={receiver.name} onChange={(event) => setReceiver((current) => ({ ...current, name: event.target.value }))} placeholder="Recipient name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px]">Phone</Label>
                      <Input className="h-9 rounded-lg text-sm" value={receiver.phone} onChange={(event) => setReceiver((current) => ({ ...current, phone: event.target.value }))} placeholder="Recipient phone" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Address <span className="text-destructive">*</span></Label>
                    <Textarea className="min-h-[90px] resize-none rounded-lg text-sm" value={receiver.address} onChange={(event) => setReceiver((current) => ({ ...current, address: event.target.value }))} placeholder="Full delivery address" />
                  </div>
                </div>
              </section>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("pick")}>Back</Button>
              <Button variant="outline" onClick={() => handleLabelAction("download")}>
                <Download className="mr-1.5 h-4 w-4" /> Download
              </Button>
              <Button onClick={() => handleLabelAction("print")}>
                <Printer className="mr-1.5 h-4 w-4" /> Print Label
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
