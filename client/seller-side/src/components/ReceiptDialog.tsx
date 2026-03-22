import { useEffect, useState } from "react";
import { ChevronRight, Download, FileText, Printer, Receipt, Truck } from "lucide-react";
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
import { toast } from "sonner";
import {
  buildA4Invoice,
  buildShippingLabel,
  buildThermalReceipt,
  downloadDoc,
  openDocWindow,
  type ReceiptOrder,
  type SenderDetails,
} from "@/lib/receiptUtils";

interface ShippingPartyForm {
  name: string;
  phone: string;
  village: string;
  postOffice: string;
  postCode: string;
  upazila: string;
  zilla: string;
  email?: string;
}

interface ReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  order: ReceiptOrder | null;
  shopName: string;
  shopId?: number;
  defaultSender?: SenderDetails;
  defaultSenderFields?: ShippingPartyForm;
}

type ReceiptDocType = "thermal" | "invoice" | "label";

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
];

const getSenderStorageKey = (shopId?: number) => `flypick-sender-${shopId ?? "default"}`;

function emptyParty(): ShippingPartyForm {
  return {
    name: "",
    phone: "",
    village: "",
    postOffice: "",
    postCode: "",
    upazila: "",
    zilla: "",
    email: "",
  };
}

function trim(value?: string | null) {
  return (value || "").trim();
}

function buildAddressBlock(party: ShippingPartyForm) {
  return [
    trim(party.village),
    trim(party.postOffice) ? `Post Office: ${trim(party.postOffice)}` : "",
    trim(party.postCode) ? `Post Code: ${trim(party.postCode)}` : "",
    [trim(party.upazila), trim(party.zilla)].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("\n");
}

function toSenderDetails(party: ShippingPartyForm): SenderDetails {
  return {
    name: trim(party.name),
    phone: trim(party.phone),
    address: buildAddressBlock(party),
    email: trim(party.email),
  };
}

function loadSender(shopId?: number): ShippingPartyForm {
  if (typeof window === "undefined") {
    return emptyParty();
  }

  try {
    const raw = window.localStorage.getItem(getSenderStorageKey(shopId));
    return raw ? { ...emptyParty(), ...JSON.parse(raw) } : emptyParty();
  } catch {
    return emptyParty();
  }
}

function saveSender(shopId: number | undefined, sender: ShippingPartyForm) {
  window.localStorage.setItem(getSenderStorageKey(shopId), JSON.stringify(sender));
}

export function ReceiptDialog({
  open,
  onClose,
  order,
  shopName,
  shopId,
  defaultSender,
  defaultSenderFields,
}: ReceiptDialogProps) {
  const [step, setStep] = useState<"pick" | "label-details">("pick");
  const [sender, setSender] = useState<ShippingPartyForm>(emptyParty());
  const [receiver, setReceiver] = useState<ShippingPartyForm>(emptyParty());

  useEffect(() => {
    if (!open) {
      setStep("pick");
      return;
    }

    const savedSender = loadSender(shopId);
    setSender({
      ...emptyParty(),
      // Saved data takes priority; only fall back to defaults when the saved field is empty
      name: savedSender.name || trim(defaultSenderFields?.name) || trim(defaultSender?.name) || shopName || "",
      phone: savedSender.phone || trim(defaultSenderFields?.phone) || trim(defaultSender?.phone) || "",
      village: savedSender.village || trim(defaultSenderFields?.village) || trim(defaultSender?.address) || "",
      postOffice: savedSender.postOffice || trim(defaultSenderFields?.postOffice) || "",
      postCode: savedSender.postCode || trim(defaultSenderFields?.postCode) || "",
      upazila: savedSender.upazila || trim(defaultSenderFields?.upazila) || "",
      zilla: savedSender.zilla || trim(defaultSenderFields?.zilla) || "",
      email: savedSender.email || trim(defaultSenderFields?.email) || trim(defaultSender?.email) || "",
    });

    if (!order) {
      setReceiver(emptyParty());
      return;
    }

    setReceiver({
      name: order.customer,
      phone: order.phone,
      village: order.address.street || "",
      postOffice: order.address.city || "",
      postCode: order.address.zip || "",
      upazila: order.address.state || "",
      zilla: order.address.country || "",
      email: order.email,
    });
  }, [defaultSender, defaultSenderFields, open, order, shopId, shopName]);

  if (!order) {
    return null;
  }

  const handleClose = () => {
    setStep("pick");
    onClose();
  };

  const generate = (type: ReceiptDocType, action: "print" | "download") => {
    const senderDetails = toSenderDetails(sender);
    const receiverDetails = toSenderDetails(receiver);

    // Always persist sender details so they're available next time
    if (trim(sender.name) || trim(sender.phone) || trim(sender.village)) {
      saveSender(shopId, sender);
    }

    let html = "";

    switch (type) {
      case "thermal":
        html = buildThermalReceipt(order, shopName, senderDetails);
        break;
      case "invoice":
        html = buildA4Invoice(order, shopName, senderDetails);
        break;
      case "label":
        html = buildShippingLabel(order, shopName, senderDetails, receiverDetails);
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
    if (!trim(sender.name) || !trim(sender.phone) || !buildAddressBlock(sender)) {
      toast.error("Please complete the sender details.");
      return;
    }

    if (!trim(receiver.name) || !trim(receiver.phone) || !buildAddressBlock(receiver)) {
      toast.error("Please complete the receiver details.");
      return;
    }

    saveSender(shopId, sender);
    generate("label", action);
  };

  const updateParty = (type: "sender" | "receiver", field: keyof ShippingPartyForm, value: string) => {
    const setter = type === "sender" ? setSender : setReceiver;
    setter((current) => ({ ...current, [field]: value }));
  };

  const renderPartyForm = (type: "sender" | "receiver", party: ShippingPartyForm, title: string) => (
    <section className="space-y-3 rounded-2xl border bg-muted/20 p-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">All fields are editable and prefilled when data is available.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-[12px]">Name</Label>
          <Input className="h-9 rounded-lg text-sm" value={party.name} onChange={(event) => updateParty(type, "name", event.target.value)} placeholder="Full name" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Mobile No</Label>
          <Input className="h-9 rounded-lg text-sm" value={party.phone} onChange={(event) => updateParty(type, "phone", event.target.value)} placeholder="Mobile number" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Village / Street</Label>
          <Input className="h-9 rounded-lg text-sm" value={party.village} onChange={(event) => updateParty(type, "village", event.target.value)} placeholder="Village or street" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Post Office / City</Label>
          <Input className="h-9 rounded-lg text-sm" value={party.postOffice} onChange={(event) => updateParty(type, "postOffice", event.target.value)} placeholder="Post office or city" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Post Code</Label>
          <Input className="h-9 rounded-lg text-sm" value={party.postCode} onChange={(event) => updateParty(type, "postCode", event.target.value)} placeholder="Post code" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Upazila / State</Label>
          <Input className="h-9 rounded-lg text-sm" value={party.upazila} onChange={(event) => updateParty(type, "upazila", event.target.value)} placeholder="Upazila or state" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-[12px]">Zilla / Country</Label>
          <Input className="h-9 rounded-lg text-sm" value={party.zilla} onChange={(event) => updateParty(type, "zilla", event.target.value)} placeholder="Zilla or country" />
        </div>
      </div>
    </section>
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className={step === "label-details" ? "sm:max-w-5xl" : "sm:max-w-lg"}>
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

            <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
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
              <DialogDescription>
                Sender and receiver details are shown side by side so you can review or edit everything before printing.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[70vh] overflow-y-auto py-1">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {renderPartyForm("sender", sender, "Sender / Return Address")}
                {renderPartyForm("receiver", receiver, "Receiver / Delivery Address")}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("pick")}>Back</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  saveSender(shopId, sender);
                  toast.success("Sender details saved");
                }}
              >
                Save Address
              </Button>
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
