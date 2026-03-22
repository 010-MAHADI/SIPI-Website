import { useState, useMemo, useEffect } from "react";
import {
  Search, Filter, Eye, Download, MoreHorizontal, Truck, CheckCircle, XCircle,
  ArrowLeft, MapPin, User, Mail, Phone, Package, CreditCard, Clock,
  ShoppingCart, DollarSign, AlertCircle, ChevronLeft, ChevronRight, Copy,
  Calendar, Send, Plus, Timer, FileText, ChevronDown, RotateCcw, RefreshCw,
  Banknote, Receipt,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import type { ReceiptOrder, SenderDetails } from "@/lib/receiptUtils";
import { toast } from "sonner";
import { useOrders, useUpdateOrderStatus } from "@/hooks/useOrders";
import { useAuth } from "@/context/AuthContext";
import { useShop } from "@/context/ShopContext";
import { useReturns, useUpdateReturnStatus } from "@/hooks/useReturns";

interface OrderItem {
  name: string;
  sku: string;
  qty: number;
  price: number;
  imageUrl?: string;
}

interface TrackingUpdate {
  status: Order["status"] | "Note" | "Refund" | "Return";
  message: string;
  date: string;
  time: string;
}

interface TimelineEvent {
  label: string;
  message?: string;
  date: string;
  done: boolean;
}

interface RefundRecord {
  id: string;
  type: "full" | "partial";
  reason: string;
  description: string;
  amount: number;
  items?: { name: string; qty: number }[];
  status: "Pending" | "Approved" | "Rejected" | "Completed";
  date: string;
}

interface Order {
  apiId: number;
  id: string;
  customer: string;
  email: string;
  phone: string;
  items: OrderItem[];
  amount: number;
  shippingCost?: number;
  discount?: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  payment: "Paid" | "Unpaid" | "Refunded" | "Partially Refunded";
  paymentMethod: string;
  date: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  trackingNumber?: string;
  notes?: string;
  trackingUpdates: TrackingUpdate[];
  deadlineDate: string;
  refunds?: RefundRecord[];
}

type DocumentVariant = "standard" | "post_office";
type DocumentAction = "print" | "download";

interface DocumentDialogState {
  open: boolean;
  action: DocumentAction;
  orderId: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
}

const defaultOrders: Order[] = [];

const orderStatusClass: Record<string, string> = {
  pending: "status-badge status-badge--warning",
  processing: "status-badge status-badge--info",
  shipped: "status-badge status-badge--info",
  delivered: "status-badge status-badge--success",
  cancelled: "status-badge status-badge--destructive",
};

const paymentClass: Record<string, string> = {
  Paid: "status-badge status-badge--success",
  Unpaid: "status-badge status-badge--warning",
  Refunded: "status-badge status-badge--destructive",
  "Partially Refunded": "status-badge status-badge--warning",
};

const ITEMS_PER_PAGE = 6;

type TabKey = "all" | "unpaid" | "to_ship" | "shipping" | "delivered" | "cancelled" | "returns";

const tabs: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "to_ship", label: "To Ship" },
  { key: "shipping", label: "Shipping" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancellation" },
  { key: "returns", label: "Return Requests" },
];

function getTabFilter(tab: TabKey, order: Order, returnRequests?: any[]): boolean {
  switch (tab) {
    case "all": return true;
    case "unpaid": return order.payment === "Unpaid";
    case "to_ship": return order.status === "pending" || order.status === "processing";
    case "shipping": return order.status === "shipped";
    case "delivered": return order.status === "delivered";
    case "cancelled": return order.status === "cancelled";
    case "returns": {
      // Show orders that have return requests
      if (!returnRequests || returnRequests.length === 0) {
        console.log('No return requests available');
        return false;
      }
      const hasReturn = returnRequests.some(r => {
        const match = r.order_id === order.id;
        if (match) {
          console.log(`Match found: Return ${r.return_id} for Order ${order.id}`);
        }
        return match;
      });
      return hasReturn;
    }
  }
}

function CountdownTimer({ deadlineDate, status }: { deadlineDate: string; status: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    if (status === "delivered" || status === "cancelled") {
      setTimeLeft("");
      return;
    }

    const update = () => {
      const now = Date.now();
      const deadline = new Date(deadlineDate + "T23:59:59").getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        setIsOverdue(true);
        const overdue = Math.abs(diff);
        const h = Math.floor(overdue / 3600000);
        const m = Math.floor((overdue % 3600000) / 60000);
        setTimeLeft(`Overdue ${h}h ${m}m`);
      } else {
        setIsOverdue(false);
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (d > 0) {
          setTimeLeft(`${d}d ${h}h ${m}m`);
        } else {
          setTimeLeft(`${h}h ${m}m ${s}s`);
        }
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadlineDate, status]);

  if (!timeLeft) return null;

  return (
    <div className={`flex items-center gap-1.5 text-xs font-semibold ${isOverdue ? "text-destructive" : "text-primary"}`}>
      <Timer className="h-3.5 w-3.5" />
      <span>{timeLeft}</span>
    </div>
  );
}

function getTimeline(order: Order): TimelineEvent[] {
  const baseEvents: TimelineEvent[] = [
    { label: "Order Placed", date: order.date, done: true },
  ];

  for (const update of order.trackingUpdates) {
    baseEvents.push({
      label: update.status === "Note" ? "Note" : update.status === "Refund" ? "Refund Initiated" : update.status === "Return" ? "Return Requested" : update.status,
      message: update.message,
      date: `${update.date} • ${update.time}`,
      done: true,
    });
  }

  if (order.status !== "cancelled") {
    const statusOrder = ["processing", "shipped", "delivered"];
    const currentIdx = statusOrder.indexOf(order.status);
    for (let i = currentIdx + 1; i < statusOrder.length; i++) {
      baseEvents.push({ label: statusOrder[i], date: "", done: false });
    }
  }

  return baseEvents;
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string | number; accent: string }) {
  return (
    <div className="stat-card relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} pointer-events-none`} />
      <div className="relative flex items-center gap-3">
        <div className={`rounded-xl p-2.5 ${accent.includes("primary") ? "bg-primary/10 text-primary" : accent.includes("success") ? "bg-success/10 text-success" : accent.includes("warning") ? "bg-warning/10 text-warning" : "bg-info/10 text-info"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

function OrderTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="relative space-y-0">
      {events.map((event, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="flex flex-col items-center">
            <div className={`h-3 w-3 rounded-full border-2 mt-1.5 ${event.done ? "bg-primary border-primary" : "bg-background border-muted-foreground/30"}`} />
            {i < events.length - 1 && (
              <div className={`w-0.5 flex-1 min-h-[28px] ${event.done ? "bg-primary/40" : "bg-muted-foreground/15"}`} />
            )}
          </div>
          <div className="pb-4 flex-1 min-w-0">
            <p className={`text-sm font-medium ${event.done ? "text-foreground" : "text-muted-foreground"}`}>{event.label}</p>
            {event.message && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{event.message}</p>}
            {event.date && <p className="text-[11px] text-muted-foreground/60 mt-0.5">{event.date}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ DIALOGS ============

interface StatusDialogState {
  open: boolean;
  orderId: string;
  targetStatus: Order["status"];
  message: string;
  trackingNumber: string;
}

interface PaymentDialogState {
  open: boolean;
  orderId: string;
  paymentMethod: string;
  description: string;
}

interface RefundDialogState {
  open: boolean;
  orderId: string;
  type: "full" | "partial";
  reason: string;
  description: string;
  refundAmount: string;
  selectedItems: Record<number, boolean>;
}

const REFUND_REASONS = [
  "Damaged product",
  "Wrong item received",
  "Item not as described",
  "Did not arrive",
  "Changed mind",
  "Defective / Not working",
  "Other",
];

const PAYMENT_METHODS = [
  "Cash on Delivery",
  "Bank Transfer",
  "Credit Card",
  "Debit Card",
  "PayPal",
  "Mobile Payment",
  "Check / Money Order",
  "Other",
];

const DOCUMENT_SENDER_STORAGE_KEY = "seller-order-document-sender";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function cleanField(value?: string | null) {
  const trimmed = (value || "").trim();
  return trimmed && trimmed !== "-" ? trimmed : "";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function formatMoney(amount: number) {
  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

function formatStatusLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getOrderSubtotal(order: Order) {
  return order.items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function getOrderShipping(order: Order) {
  const subtotal = getOrderSubtotal(order);
  return Math.max(order.amount - subtotal, 0);
}

function formatAddressBlock(lines: string[]) {
  return lines
    .map((line) => escapeHtml(cleanField(line)))
    .filter(Boolean)
    .join("<br />");
}

function getOrderAddressLines(order: Order) {
  const cityStateZip = [cleanField(order.address.city), cleanField(order.address.state), cleanField(order.address.zip)]
    .filter(Boolean)
    .join(", ");

  return [
    cleanField(order.customer),
    cleanField(order.phone),
    cleanField(order.address.street),
    cityStateZip,
    cleanField(order.address.country),
  ].filter(Boolean);
}

function getSenderStorageKey(shopId?: number) {
  return `${DOCUMENT_SENDER_STORAGE_KEY}:${shopId ?? "default"}`;
}

function loadSavedSenderDetails(shopId?: number) {
  if (typeof window === "undefined") {
    return { senderName: "", senderPhone: "", senderAddress: "" };
  }

  try {
    const raw = window.localStorage.getItem(getSenderStorageKey(shopId));
    if (!raw) {
      return { senderName: "", senderPhone: "", senderAddress: "" };
    }

    const parsed = JSON.parse(raw);
    return {
      senderName: cleanField(parsed?.senderName),
      senderPhone: cleanField(parsed?.senderPhone),
      senderAddress: cleanField(parsed?.senderAddress),
    };
  } catch {
    return { senderName: "", senderPhone: "", senderAddress: "" };
  }
}

function saveSenderDetails(shopId: number | undefined, values: { senderName: string; senderPhone: string; senderAddress: string }) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getSenderStorageKey(shopId),
    JSON.stringify({
      senderName: cleanField(values.senderName),
      senderPhone: cleanField(values.senderPhone),
      senderAddress: cleanField(values.senderAddress),
    }),
  );
}

function buildOrderDocumentHtml({
  order,
  shopName,
  variant,
  sender,
  receiver,
  autoPrint,
}: {
  order: Order;
  shopName: string;
  variant: DocumentVariant;
  sender?: { name: string; phone: string; address: string };
  receiver?: { name: string; phone: string; address: string };
  autoPrint?: boolean;
}) {
  const subtotal = getOrderSubtotal(order);
  const shipping = getOrderShipping(order);
  const receiverLines = receiver
    ? [
        cleanField(receiver.name),
        cleanField(receiver.phone),
        ...cleanField(receiver.address).split(/\r?\n/).map((line) => cleanField(line)),
      ].filter(Boolean)
    : getOrderAddressLines(order);
  const senderLines = sender
    ? [
        cleanField(sender.name),
        cleanField(sender.phone),
        ...cleanField(sender.address).split(/\r?\n/).map((line) => cleanField(line)),
      ].filter(Boolean)
    : [];
  const trackingNumber = cleanField(order.trackingNumber) || "Pending assignment";
  const variantTitle = variant === "post_office" ? "Post Office Invoice / AWB" : "Invoice / AWB";
  const variantBadge = variant === "post_office" ? "POST OFFICE" : "STANDARD";
  const rightColumnHtml = variant === "post_office"
    ? `
      <div class="panel emphasis">
        <div class="panel-label">Sender Address</div>
        <div class="address-block">${formatAddressBlock(senderLines.length ? senderLines : [shopName, "Add sender address before printing"])}</div>
      </div>
      <div class="panel">
        <div class="panel-label">Delivery Address</div>
        <div class="address-block">${formatAddressBlock(receiverLines)}</div>
      </div>
      <div class="panel meta-panel">
        <div class="panel-label">Dispatch Details</div>
        <div class="meta-grid">
          <div><span>Order ID</span><strong>${escapeHtml(order.id)}</strong></div>
          <div><span>Tracking</span><strong>${escapeHtml(trackingNumber)}</strong></div>
          <div><span>Payment</span><strong>${escapeHtml(order.payment)}</strong></div>
          <div><span>Status</span><strong>${escapeHtml(formatStatusLabel(order.status))}</strong></div>
        </div>
      </div>
    `
    : `
      <div class="panel emphasis grow">
        <div class="panel-label">Delivery Address</div>
        <div class="address-block">${formatAddressBlock(receiverLines)}</div>
      </div>
      <div class="panel meta-panel">
        <div class="panel-label">Shipping Details</div>
        <div class="meta-grid">
          <div><span>Tracking</span><strong>${escapeHtml(trackingNumber)}</strong></div>
          <div><span>Payment</span><strong>${escapeHtml(order.payment)}</strong></div>
          <div><span>Method</span><strong>${escapeHtml(order.paymentMethod)}</strong></div>
          <div><span>Customer</span><strong>${escapeHtml(order.customer)}</strong></div>
        </div>
      </div>
    `;

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(order.id)} ${variantTitle}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #f3f4f6; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    body { padding: 0; }
    .sheet {
      width: 100%;
      min-height: calc(210mm - 20mm);
      background: #ffffff;
      border: 1px solid #d1d5db;
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
    }
    .left, .right { padding: 16mm 14mm; }
    .right { border-left: 1px dashed #9ca3af; background: #fafafa; display: flex; flex-direction: column; gap: 12px; }
    .brand-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }
    .brand h1 {
      margin: 0;
      font-size: 28px;
      line-height: 1;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .brand p {
      margin: 6px 0 0;
      color: #4b5563;
      font-size: 13px;
    }
    .badge {
      border: 1px solid #111827;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
    }
    .meta-table {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 18px;
      padding: 14px;
      border: 1px solid #d1d5db;
      background: #f9fafb;
      margin-bottom: 18px;
    }
    .meta-item span, .panel-label, .totals span:first-child, .signature span {
      display: block;
      color: #6b7280;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 4px;
    }
    .meta-item strong, .meta-grid strong {
      font-size: 13px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
    }
    th, td {
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
      padding: 10px 8px;
      font-size: 12px;
      vertical-align: top;
    }
    th {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6b7280;
      background: #f9fafb;
    }
    .money, .qty { text-align: right; white-space: nowrap; }
    .sku {
      display: block;
      margin-top: 4px;
      color: #6b7280;
      font-size: 11px;
    }
    .totals {
      width: 260px;
      margin-left: auto;
      margin-top: 16px;
      border-top: 1px solid #d1d5db;
      padding-top: 12px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .totals-row.total {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #111827;
      font-size: 16px;
      font-weight: 700;
    }
    .panel {
      border: 1px solid #d1d5db;
      background: #ffffff;
      padding: 14px;
    }
    .panel.emphasis {
      border-color: #111827;
      background: #f8fafc;
    }
    .panel.grow { flex: 1; }
    .address-block {
      font-size: 18px;
      line-height: 1.6;
      font-weight: 700;
      white-space: normal;
      word-break: break-word;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .meta-grid span {
      display: block;
      color: #6b7280;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 4px;
    }
    .footer {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      margin-top: 28px;
    }
    .signature {
      border-top: 1px solid #9ca3af;
      padding-top: 10px;
      min-height: 48px;
    }
    .note {
      margin-top: 16px;
      padding: 10px 12px;
      border-left: 4px solid #111827;
      background: #f9fafb;
      color: #374151;
      font-size: 12px;
      line-height: 1.5;
    }
    @media print {
      html, body { background: #ffffff; }
      .sheet { border: none; min-height: auto; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <section class="left">
      <div class="brand-row">
        <div class="brand">
          <h1>${escapeHtml(variantTitle)}</h1>
          <p>${escapeHtml(shopName || "Flypick Seller")} dispatch document</p>
        </div>
        <div class="badge">${escapeHtml(variantBadge)}</div>
      </div>

      <div class="meta-table">
        <div class="meta-item"><span>Order ID</span><strong>${escapeHtml(order.id)}</strong></div>
        <div class="meta-item"><span>Order Date</span><strong>${escapeHtml(order.date)}</strong></div>
        <div class="meta-item"><span>Payment</span><strong>${escapeHtml(order.payment)}</strong></div>
        <div class="meta-item"><span>Status</span><strong>${escapeHtml(formatStatusLabel(order.status))}</strong></div>
        <div class="meta-item"><span>Tracking Number</span><strong>${escapeHtml(trackingNumber)}</strong></div>
        <div class="meta-item"><span>Customer Email</span><strong>${escapeHtml(cleanField(order.email) || "N/A")}</strong></div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 44%;">Item</th>
            <th>SKU</th>
            <th class="qty">Qty</th>
            <th class="money">Unit Price</th>
            <th class="money">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map((item) => `
            <tr>
              <td>
                <strong>${escapeHtml(item.name)}</strong>
                <span class="sku">${escapeHtml(item.sku)}</span>
              </td>
              <td>${escapeHtml(item.sku)}</td>
              <td class="qty">${item.qty}</td>
              <td class="money">${formatMoney(item.price)}</td>
              <td class="money">${formatMoney(item.price * item.qty)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row"><span>Subtotal</span><strong>${formatMoney(subtotal)}</strong></div>
        <div class="totals-row"><span>Shipping</span><strong>${formatMoney(shipping)}</strong></div>
        <div class="totals-row total"><span>Total</span><strong>${formatMoney(order.amount)}</strong></div>
      </div>

      <div class="note">
        ${variant === "post_office"
          ? "Prepared for post office dispatch. Please verify sender and receiver details before handing over the parcel."
          : "Prepared as a standard invoice and delivery label. Please verify tracking and delivery details before dispatch."}
      </div>

      <div class="footer">
        <div class="signature"><span>Prepared By</span>${escapeHtml(shopName || "Seller Team")}</div>
        <div class="signature"><span>Received / Courier Signature</span></div>
      </div>
    </section>

    <aside class="right">
      ${rightColumnHtml}
    </aside>
  </main>
  ${autoPrint ? `
  <script>
    window.addEventListener("load", function () {
      window.focus();
      setTimeout(function () {
        window.print();
      }, 250);
    });
    window.addEventListener("afterprint", function () {
      window.close();
    });
  </script>
  ` : ""}
</body>
</html>
  `;
}

export default function Orders() {
  const { user } = useAuth();
  const { currentShop } = useShop();
  const selectedShopId = currentShop?.id ? Number(currentShop.id) : undefined;
  const { data: fetchedOrders, isLoading } = useOrders(selectedShopId);
  const updateOrderStatus = useUpdateOrderStatus();
  const { data: returnRequests } = useReturns(selectedShopId);
  const updateReturnStatus = useUpdateReturnStatus();
  const [orders, setOrders] = useState(defaultOrders);

  // Debug logging
  useEffect(() => {
    console.log('=== RETURN REQUEST DEBUG ===');
    console.log('Current Shop ID:', currentShop?.id);
    console.log('Return Requests:', returnRequests);
    console.log('Total Orders:', orders.length);
    
    if (returnRequests && returnRequests.length > 0) {
      console.log('Return Request Order IDs:', returnRequests.map(r => ({ id: r.order_id, return_id: r.return_id })));
      console.log('Order IDs:', orders.map(o => ({ id: o.id, customer: o.customer })));
      
      const matchingOrders = orders.filter(o => 
        returnRequests.some(r => r.order_id === o.id)
      );
      console.log('Orders with Returns:', matchingOrders.length, matchingOrders);
    } else {
      console.log('No return requests found');
    }
    console.log('=== END DEBUG ===');
  }, [returnRequests, orders, currentShop]);

  useEffect(() => {
    if (fetchedOrders) {
      console.log('Raw fetched orders (first one):', fetchedOrders[0]);
      const mappedOrders = fetchedOrders.map((o) => {
        // Use order_id if available, otherwise use id (which should be the order_id string from backend)
        const orderId = o.id;  // o.id is already the order_id string from useOrders hook
        console.log('Mapping order - api_id:', o.api_id, 'id:', o.id, 'using:', orderId);
        return {
          apiId: o.api_id,  // Use api_id which is the database ID
          id: orderId,
          customer: o.customer_name || "Unknown",
          email: o.customer_email || "hidden@example.com",
          phone: o.shipping_phone || "-",
          items: o.items.map((item, index) => ({
            name: item.product_title || "Product Item",
            sku: item.product ? `PID-${item.product}` : `ITEM-${index + 1}`,
            qty: item.quantity || 1,
            price: Number(item.price) || 0,
            imageUrl: item.product_image_url || undefined,
          })),
          amount: o.total || 0,
          shippingCost: o.shipping_cost || 0,
          discount: o.discount || 0,
          status: o.status,
          payment: o.payment_status === "paid"
            ? "Paid"
            : o.payment_status === "refunded"
              ? "Refunded"
              : "Unpaid",
          paymentMethod: o.paymentMethod || "N/A",
          date: o.date || "-",
          address: {
            street: o.shipping_street || "-",
            city: o.shipping_city || "-",
            state: o.shipping_state || "-",
            zip: o.shipping_zip_code || "-",
            country: o.shipping_country || "-",
          },
          trackingUpdates: [],
          deadlineDate: "2026-12-31",
        };
      }) as Order[];
      setOrders(mappedOrders);
    }
  }, [fetchedOrders]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<ReceiptOrder | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [trackingMessage, setTrackingMessage] = useState("");
  const [trackingStatus, setTrackingStatus] = useState<Order["status"] | "Note">("Note");
  const [trackingNumberInput, setTrackingNumberInput] = useState("");

  // Dialog states
  const [statusDialog, setStatusDialog] = useState<StatusDialogState>({
    open: false, orderId: "", targetStatus: "processing", message: "", trackingNumber: "",
  });
  const [paymentDialog, setPaymentDialog] = useState<PaymentDialogState>({
    open: false, orderId: "", paymentMethod: "", description: "",
  });
  const [refundDialog, setRefundDialog] = useState<RefundDialogState>({
    open: false, orderId: "", type: "full", reason: "", description: "", refundAmount: "", selectedItems: {},
  });
  const [documentDialog, setDocumentDialog] = useState<DocumentDialogState>({
    open: false,
    action: "print",
    orderId: "",
    senderName: "",
    senderPhone: "",
    senderAddress: "",
    receiverName: "",
    receiverPhone: "",
    receiverAddress: "",
  });

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch = (o.id?.toLowerCase() || '').includes(search.toLowerCase()) || 
                         (o.customer?.toLowerCase() || '').includes(search.toLowerCase()) || 
                         (o.email?.toLowerCase() || '').includes(search.toLowerCase());
      const matchTab = getTabFilter(statusFilter as TabKey, o, returnRequests);
      const matchPayment = paymentFilter === "all" || o.payment === paymentFilter;
      return matchSearch && matchTab && matchPayment;
    });
  }, [orders, search, statusFilter, paymentFilter, returnRequests]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const stats = useMemo(() => {
    if (isLoading) return { total: 0, revenue: 0, pending: 0, delivered: 0 };
    const total = orders.length;
    const revenue = orders.reduce((s, o) => s + (o.payment !== "Refunded" ? o.amount : 0), 0);
    const pending = orders.filter((o) => o.status === "pending" || o.status === "processing").length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    return { total, revenue, pending, delivered };
  }, [orders, isLoading]);

  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = { all: 0, unpaid: 0, to_ship: 0, shipping: 0, delivered: 0, cancelled: 0, returns: 0 };
    orders.forEach((o) => {
      counts.all++;
      if (o.payment === "Unpaid") counts.unpaid++;
      if (o.status === "pending" || o.status === "processing") counts.to_ship++;
      if (o.status === "shipped") counts.shipping++;
      if (o.status === "delivered") counts.delivered++;
      if (o.status === "cancelled") counts.cancelled++;
    });
    // Count orders with return requests
    if (returnRequests) {
      const orderIdsWithReturns = new Set(returnRequests.map(r => r.order_id));
      counts.returns = orders.filter(o => orderIdsWithReturns.has(o.id)).length;
    }
    return counts;
  }, [orders, returnRequests]);

  const receiptSender = useMemo<SenderDetails>(() => {
    const profile = user?.seller_profile;
    const senderName = (profile?.sender_name || "").trim() || currentShop?.name || user?.username || "Flypick";
    const phone = (profile?.mobile_no || profile?.phone || "").trim();
    const addressLines = [
      (profile?.village || "").trim(),
      (profile?.post_office || "").trim() ? `Post Office: ${(profile?.post_office || "").trim()}` : "",
      (profile?.post_code || "").trim() ? `Post Code: ${(profile?.post_code || "").trim()}` : "",
      [(profile?.upazila || "").trim(), (profile?.zilla || "").trim()].filter(Boolean).join(", "),
    ].filter(Boolean);
    const legacyAddress = (profile?.address || "").trim();

    return {
      name: senderName,
      phone,
      address: addressLines.length ? addressLines.join("\n") : legacyAddress,
      email: user?.email || "",
    };
  }, [currentShop?.name, user]);

  const receiptSenderFields = useMemo(
    () => ({
      name: (user?.seller_profile?.sender_name || "").trim() || currentShop?.name || user?.username || "Flypick",
      phone: (user?.seller_profile?.mobile_no || user?.seller_profile?.phone || "").trim(),
      village: (user?.seller_profile?.village || "").trim(),
      postOffice: (user?.seller_profile?.post_office || "").trim(),
      postCode: (user?.seller_profile?.post_code || "").trim(),
      upazila: (user?.seller_profile?.upazila || "").trim(),
      zilla: (user?.seller_profile?.zilla || "").trim(),
      email: user?.email || "",
    }),
    [currentShop?.name, user]
  );

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  // Open status dialog instead of direct update
  const openStatusDialog = (orderId: string, targetStatus: Order["status"]) => {
    const order = orders.find(o => o.id === orderId);
    setStatusDialog({
      open: true,
      orderId,
      targetStatus,
      message: "",
      trackingNumber: order?.trackingNumber || "",
    });
  };

  const confirmStatusUpdate = async () => {
    const { orderId, targetStatus, message, trackingNumber } = statusDialog;
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) {
      toast.error("Order not found");
      return;
    }
    if (!targetOrder.apiId) {
      toast.error("Invalid order reference - missing API ID");
      console.error("Order missing apiId:", targetOrder);
      return;
    }

    console.log('Attempting to update order:', {
      orderId,
      apiId: targetOrder.apiId,
      targetStatus,
      message,
      trackingNumber
    });

    try {
      const result = await updateOrderStatus.mutateAsync({
        orderApiId: targetOrder.apiId,
        status: targetStatus,
      });
      console.log('Status update successful:', result);
    } catch (error: any) {
      console.error('Status update failed:', error);
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.status?.[0] ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to update order status";
      toast.error(`Update failed: ${errorMessage}`);
      return;
    }

    const update: TrackingUpdate = {
      status: targetStatus,
      message: message.trim() || `Order marked as ${targetStatus}`,
      date: todayStr,
      time: timeStr,
    };
    setOrders((prev) => prev.map((o) => o.id === orderId ? {
      ...o,
      status: targetStatus,
      trackingUpdates: [...o.trackingUpdates, update],
      trackingNumber: trackingNumber.trim() || o.trackingNumber,
    } : o));
    if (selectedOrder?.id === orderId) {
      setSelectedOrder((prev) => prev ? {
        ...prev,
        status: targetStatus,
        trackingUpdates: [...prev.trackingUpdates, update],
        trackingNumber: trackingNumber.trim() || prev.trackingNumber,
      } : null);
    }
    toast.success(`Order ${orderId} marked as ${targetStatus}`);
    setStatusDialog({ open: false, orderId: "", targetStatus: "processing", message: "", trackingNumber: "" });
  };

  // Payment confirmation for unpaid orders
  const openPaymentDialog = (orderId: string) => {
    setPaymentDialog({ open: true, orderId, paymentMethod: "", description: "" });
  };

  const confirmPayment = () => {
    const { orderId, paymentMethod, description } = paymentDialog;
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    const update: TrackingUpdate = {
      status: "Note",
      message: `Payment received via ${paymentMethod}${description ? ` — ${description}` : ""}`,
      date: todayStr,
      time: timeStr,
    };
    setOrders((prev) => prev.map((o) => o.id === orderId ? {
      ...o,
      payment: "Paid" as const,
      paymentMethod,
      trackingUpdates: [...o.trackingUpdates, update],
    } : o));
    if (selectedOrder?.id === orderId) {
      setSelectedOrder((prev) => prev ? {
        ...prev,
        payment: "Paid" as const,
        paymentMethod,
        trackingUpdates: [...prev.trackingUpdates, update],
      } : null);
    }
    toast.success(`Order ${orderId} marked as Paid`);
    setPaymentDialog({ open: false, orderId: "", paymentMethod: "", description: "" });
  };

  // Refund/Return system
  const openRefundDialog = (orderId: string) => {
    setRefundDialog({ open: false, orderId: "", type: "full", reason: "", description: "", refundAmount: "", selectedItems: {} });
    // Small delay to reset then open
    setTimeout(() => {
      setRefundDialog({ open: true, orderId, type: "full", reason: "", description: "", refundAmount: "", selectedItems: {} });
    }, 10);
  };

  const confirmRefund = () => {
    const { orderId, type, reason, description, refundAmount, selectedItems } = refundDialog;
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const amount = type === "full" ? order.amount : parseFloat(refundAmount) || 0;
    if (type === "partial" && (amount <= 0 || amount > order.amount)) {
      toast.error("Please enter a valid refund amount");
      return;
    }

    const selectedItemsList = type === "partial"
      ? order.items.filter((_, i) => selectedItems[i]).map(item => ({ name: item.name, qty: item.qty }))
      : undefined;

    const refundRecord: RefundRecord = {
      id: `RF-${Date.now().toString(36).toUpperCase()}`,
      type,
      reason,
      description: description.trim(),
      amount,
      items: selectedItemsList,
      status: "Pending",
      date: todayStr,
    };

    const trackingUpdate: TrackingUpdate = {
      status: "Refund",
      message: `${type === "full" ? "Full" : "Partial"} refund of $${amount.toFixed(2)} initiated — ${reason}${description ? `: ${description}` : ""}`,
      date: todayStr,
      time: timeStr,
    };

    const newPayment = type === "full" ? "Refunded" as const : "Partially Refunded" as const;

    setOrders((prev) => prev.map((o) => o.id === orderId ? {
      ...o,
      payment: newPayment,
      refunds: [...(o.refunds || []), refundRecord],
      trackingUpdates: [...o.trackingUpdates, trackingUpdate],
    } : o));
    if (selectedOrder?.id === orderId) {
      setSelectedOrder((prev) => prev ? {
        ...prev,
        payment: newPayment,
        refunds: [...(prev.refunds || []), refundRecord],
        trackingUpdates: [...prev.trackingUpdates, trackingUpdate],
      } : null);
    }
    toast.success(`Refund of $${amount.toFixed(2)} initiated for ${orderId}`);
    setRefundDialog({ open: false, orderId: "", type: "full", reason: "", description: "", refundAmount: "", selectedItems: {} });
  };

  const updateRefundStatus = (orderId: string, refundId: string, newStatus: RefundRecord["status"]) => {
    setOrders((prev) => prev.map((o) => o.id === orderId ? {
      ...o,
      refunds: o.refunds?.map(r => r.id === refundId ? { ...r, status: newStatus } : r),
    } : o));
    if (selectedOrder?.id === orderId) {
      setSelectedOrder((prev) => prev ? {
        ...prev,
        refunds: prev.refunds?.map(r => r.id === refundId ? { ...r, status: newStatus } : r),
      } : null);
    }
    toast.success(`Refund ${refundId} marked as ${newStatus}`);
  };

  const addTrackingUpdate = () => {
    if (!selectedOrder || !trackingMessage.trim()) return;
    const update: TrackingUpdate = {
      status: trackingStatus,
      message: trackingMessage.trim(),
      date: todayStr,
      time: timeStr,
    };

    const newStatus = trackingStatus !== "Note" ? trackingStatus as Order["status"] : selectedOrder.status;
    const newTracking = trackingNumberInput.trim() || selectedOrder.trackingNumber;

    setOrders((prev) => prev.map((o) =>
      o.id === selectedOrder.id
        ? { ...o, status: newStatus, trackingUpdates: [...o.trackingUpdates, update], trackingNumber: newTracking }
        : o
    ));
    setSelectedOrder((prev) =>
      prev ? { ...prev, status: newStatus, trackingUpdates: [...prev.trackingUpdates, update], trackingNumber: newTracking } : null
    );

    toast.success(trackingStatus === "Note" ? "Tracking note added" : `Order updated to ${trackingStatus}`);
    setTrackingMessage("");
    setTrackingStatus("Note");
    setTrackingNumberInput("");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const openReceipt = (order: Order) => {
    setReceiptOrder({
      id: order.id,
      apiId: order.apiId,
      customer: order.customer,
      email: order.email,
      phone: order.phone,
      items: order.items,
      amount: order.amount,
      shippingCost: order.shippingCost,
      discount: order.discount,
      status: order.status,
      payment: order.payment,
      paymentMethod: order.paymentMethod,
      date: order.date,
      address: order.address,
      trackingNumber: order.trackingNumber,
      notes: order.notes,
    });
    setReceiptOpen(true);
  };

  const createDocumentFileName = (orderId: string, variant: DocumentVariant) =>
    `${orderId}-${variant === "post_office" ? "post-office-awb" : "invoice-awb"}.html`;

  const runDocumentAction = (
    order: Order,
    variant: DocumentVariant,
    action: DocumentAction,
    overrides?: {
      sender?: { name: string; phone: string; address: string };
      receiver?: { name: string; phone: string; address: string };
    },
  ) => {
    const html = buildOrderDocumentHtml({
      order,
      shopName: currentShop?.name || "Seller Shop",
      variant,
      sender: overrides?.sender,
      receiver: overrides?.receiver,
      autoPrint: action === "print",
    });

    if (action === "print") {
      const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
      if (!printWindow) {
        toast.error("Popup blocked. Please allow popups to print documents.");
        return;
      }

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      toast.success(variant === "post_office" ? "Post office print preview opened" : "Invoice / AWB print preview opened");
      return;
    }

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = createDocumentFileName(order.id, variant);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success(variant === "post_office" ? "Post office document downloaded" : "Invoice / AWB document downloaded");
  };

  const openPostOfficeDocumentDialog = (orderId: string, action: DocumentAction) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) {
      toast.error("Order not found");
      return;
    }

    const savedSender = loadSavedSenderDetails(selectedShopId);
    setDocumentDialog({
      open: true,
      action,
      orderId,
      senderName: savedSender.senderName || currentShop?.name || "",
      senderPhone: savedSender.senderPhone || "",
      senderAddress: savedSender.senderAddress || "",
      receiverName: cleanField(order.customer),
      receiverPhone: cleanField(order.phone),
      receiverAddress: getOrderAddressLines(order).slice(2).join("\n"),
    });
  };

  const handleStandardDocument = (orderId: string, action: DocumentAction) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) {
      toast.error("Order not found");
      return;
    }

    runDocumentAction(order, "standard", action);
  };

  const submitPostOfficeDocument = () => {
    const order = orders.find((item) => item.id === documentDialog.orderId);
    if (!order) {
      toast.error("Order not found");
      return;
    }

    if (!cleanField(documentDialog.senderName) || !cleanField(documentDialog.senderAddress)) {
      toast.error("Sender name and sender address are required");
      return;
    }

    if (!cleanField(documentDialog.receiverName) || !cleanField(documentDialog.receiverAddress)) {
      toast.error("Delivery name and delivery address are required");
      return;
    }

    saveSenderDetails(selectedShopId, {
      senderName: documentDialog.senderName,
      senderPhone: documentDialog.senderPhone,
      senderAddress: documentDialog.senderAddress,
    });

    runDocumentAction(order, "post_office", documentDialog.action, {
      sender: {
        name: documentDialog.senderName,
        phone: documentDialog.senderPhone,
        address: documentDialog.senderAddress,
      },
      receiver: {
        name: documentDialog.receiverName,
        phone: documentDialog.receiverPhone,
        address: documentDialog.receiverAddress,
      },
    });

    setDocumentDialog({
      open: false,
      action: "print",
      orderId: "",
      senderName: "",
      senderPhone: "",
      senderAddress: "",
      receiverName: "",
      receiverPhone: "",
      receiverAddress: "",
    });
  };

  const statusDialogLabels: Record<string, { title: string; icon: React.ElementType; description: string }> = {
    processing: { title: "Start Processing", icon: Clock, description: "Mark this order as being processed. Add a message for the tracking timeline." },
    shipped: { title: "Mark as Shipped", icon: Truck, description: "Confirm shipment. You can add a tracking number and message." },
    delivered: { title: "Mark as Delivered", icon: CheckCircle, description: "Confirm delivery completion with an optional note." },
    cancelled: { title: "Cancel Order", icon: XCircle, description: "Cancel this order. Please provide a reason." },
  };

  const currentStatusLabel = statusDialogLabels[statusDialog.targetStatus] || statusDialogLabels.processing;
  const StatusIcon = currentStatusLabel.icon;
  const renderDocumentMenu = (order: Order, compact = false) => (
    <Button
      size="sm"
      variant="outline"
      className={`rounded-lg ${compact ? "h-8 px-2.5 text-xs" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        openReceipt(order);
      }}
    >
      <Receipt className="mr-1.5 h-3.5 w-3.5" /> Docs
    </Button>
  );

  // Detail view
  if (selectedOrder) {
    const timeline = getTimeline(selectedOrder);
    const orderForRefund = orders.find(o => o.id === selectedOrder.id) || selectedOrder;

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Dialogs rendered at top */}
        {renderDialogs()}

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(null)} className="rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Order #{selectedOrder.id}</h1>
              <span className={orderStatusClass[selectedOrder.status]}>{selectedOrder.status}</span>
              <span className={paymentClass[selectedOrder.payment]}>{selectedOrder.payment}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Placed on {selectedOrder.date}</span>
              <span className="mx-1">•</span>
              <span>{selectedOrder.items.reduce((s, i) => s + i.qty, 0)} items</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {renderDocumentMenu(selectedOrder)}
            {selectedOrder.payment === "Unpaid" && (
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => openPaymentDialog(selectedOrder.id)}>
                <Banknote className="h-4 w-4 mr-1.5" /> Mark Paid
              </Button>
            )}
            {selectedOrder.status !== "delivered" && selectedOrder.status !== "cancelled" && (
              <>
                {selectedOrder.status === "pending" && (
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => openStatusDialog(selectedOrder.id, "processing")}>
                    <Clock className="h-4 w-4 mr-1.5" /> Start Processing
                  </Button>
                )}
                {(selectedOrder.status === "pending" || selectedOrder.status === "processing") && (
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => openStatusDialog(selectedOrder.id, "shipped")}>
                    <Truck className="h-4 w-4 mr-1.5" /> Mark Shipped
                  </Button>
                )}
                <Button size="sm" className="rounded-lg" onClick={() => openStatusDialog(selectedOrder.id, "delivered")}>
                  <CheckCircle className="h-4 w-4 mr-1.5" /> Mark Delivered
                </Button>
              </>
            )}
            {selectedOrder.status === "delivered" && selectedOrder.payment !== "Refunded" && (
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => openRefundDialog(selectedOrder.id)}>
                <RotateCcw className="h-4 w-4 mr-1.5" /> Return / Refund
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="stat-card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="section-title flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Order Items</h2>
                <Badge variant="secondary" className="font-mono text-xs">{selectedOrder.items.length} item{selectedOrder.items.length > 1 ? "s" : ""}</Badge>
              </div>
              <div className="space-y-3">
                {selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/40 hover:border-primary/20 transition-colors">
                    <div className="h-14 w-14 rounded-xl bg-muted/50 overflow-hidden shrink-0">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">No image</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">SKU: {item.sku}</p>
                    </div>
                    <div className="text-center px-3">
                      <p className="text-xs text-muted-foreground">Qty</p>
                      <p className="font-semibold text-sm">{item.qty}</p>
                    </div>
                    <div className="text-center px-3">
                      <p className="text-xs text-muted-foreground">Unit Price</p>
                      <p className="font-semibold text-sm">${item.price.toFixed(2)}</p>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-bold text-sm">${(item.price * item.qty).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="my-2" />
              <div className="space-y-2.5 text-sm max-w-xs ml-auto">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">${(selectedOrder.amount - (selectedOrder.amount * 0.05)).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className="font-medium">${(selectedOrder.amount * 0.05).toFixed(2)}</span></div>
                <Separator />
                <div className="flex justify-between font-bold text-base pt-1"><span>Total</span><span className="text-primary">${selectedOrder.amount.toFixed(2)}</span></div>
              </div>
            </div>

            {/* Customer Details & Shipping Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="stat-card space-y-3">
                <h2 className="section-title flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Customer Details</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {selectedOrder.customer.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <p className="font-semibold">{selectedOrder.customer}</p>
                      <p className="text-xs text-muted-foreground">{selectedOrder.email}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-2.5"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">{selectedOrder.phone}</span></div>
                  <div className="flex items-center gap-2.5"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">{selectedOrder.email}</span></div>
                </div>
              </div>

              <div className="stat-card space-y-3">
                <h2 className="section-title flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Shipping Address</h2>
                <div className="text-sm space-y-0.5 bg-muted/30 rounded-lg p-3 border border-border/40">
                  <p className="font-medium">{selectedOrder.customer}</p>
                  <p className="text-muted-foreground">{selectedOrder.phone}</p>
                  <p className="text-muted-foreground">{selectedOrder.address.street}</p>
                  <p className="text-muted-foreground">{selectedOrder.address.city}, {selectedOrder.address.state} {selectedOrder.address.zip}</p>
                  <p className="text-muted-foreground">{selectedOrder.address.country}</p>
                </div>
                {selectedOrder.trackingNumber && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-1.5">Tracking Number</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono bg-muted/50 px-3 py-2 rounded-lg border border-border/40 flex-1 truncate">{selectedOrder.trackingNumber}</p>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-lg" onClick={() => copyToClipboard(selectedOrder.trackingNumber!)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectedOrder.notes && (
              <div className="stat-card space-y-2">
                <h2 className="section-title flex items-center gap-2"><AlertCircle className="h-4 w-4 text-warning" /> Order Notes</h2>
                <p className="text-sm text-muted-foreground leading-relaxed bg-warning/5 border border-warning/20 rounded-lg p-3">{selectedOrder.notes}</p>
              </div>
            )}

            {/* Refund Records */}
            {orderForRefund.refunds && orderForRefund.refunds.length > 0 && (
              <div className="stat-card space-y-4">
                <h2 className="section-title flex items-center gap-2"><RotateCcw className="h-5 w-5 text-primary" /> Returns & Refunds</h2>
                <div className="space-y-3">
                  {orderForRefund.refunds.map((refund) => (
                    <div key={refund.id} className="p-4 rounded-xl bg-muted/30 border border-border/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold">{refund.id}</span>
                          <Badge variant={
                            refund.status === "Completed" ? "default" :
                              refund.status === "Approved" ? "secondary" :
                                refund.status === "Rejected" ? "destructive" : "outline"
                          } className="text-[10px]">
                            {refund.status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] capitalize">{refund.type} refund</Badge>
                        </div>
                        <span className="font-bold text-sm text-destructive">-${refund.amount.toFixed(2)}</span>
                      </div>
                      <div className="text-xs space-y-1">
                        <p><span className="text-muted-foreground">Reason:</span> <span className="font-medium">{refund.reason}</span></p>
                        {refund.description && <p><span className="text-muted-foreground">Details:</span> {refund.description}</p>}
                        {refund.items && refund.items.length > 0 && (
                          <p><span className="text-muted-foreground">Items:</span> {refund.items.map(i => `${i.name} (x${i.qty})`).join(", ")}</p>
                        )}
                        <p className="text-muted-foreground/60">Filed on {refund.date}</p>
                      </div>
                      {refund.status === "Pending" && (
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="outline" className="rounded-lg text-xs h-7" onClick={() => updateRefundStatus(selectedOrder.id, refund.id, "Approved")}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-lg text-xs h-7 text-destructive" onClick={() => updateRefundStatus(selectedOrder.id, refund.id, "Rejected")}>
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                      {refund.status === "Approved" && (
                        <Button size="sm" className="rounded-lg text-xs h-7" onClick={() => updateRefundStatus(selectedOrder.id, refund.id, "Completed")}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Mark Completed
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Return Requests */}
            {returnRequests && returnRequests.filter(r => r.order_id === selectedOrder.id).length > 0 && (
              <div className="stat-card space-y-4">
                <h2 className="section-title flex items-center gap-2"><RotateCcw className="h-5 w-5 text-warning" /> Return Requests</h2>
                <div className="space-y-3">
                  {returnRequests.filter(r => r.order_id === selectedOrder.id).map((returnReq) => (
                    <div key={returnReq.id} className="p-4 rounded-xl bg-warning/5 border border-warning/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold">{returnReq.return_id}</span>
                          <Badge variant={
                            returnReq.status === "refunded" ? "default" :
                              returnReq.status === "approved" ? "secondary" :
                                returnReq.status === "rejected" ? "destructive" : "outline"
                          } className="text-[10px] capitalize">
                            {returnReq.status}
                          </Badge>
                        </div>
                        {returnReq.refund_amount && (
                          <span className="font-bold text-sm text-destructive">-${parseFloat(returnReq.refund_amount).toFixed(2)}</span>
                        )}
                      </div>
                      <div className="text-xs space-y-1">
                        <p><span className="text-muted-foreground">Reason:</span> <span className="font-medium">{returnReq.reason}</span></p>
                        {returnReq.description && <p><span className="text-muted-foreground">Details:</span> {returnReq.description}</p>}
                        {returnReq.items && returnReq.items.length > 0 && (
                          <div className="mt-2">
                            <p className="text-muted-foreground mb-1">Items to return:</p>
                            <div className="space-y-1">
                              {returnReq.items.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  <span>• {item.product_title} (x{item.quantity})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {returnReq.admin_note && (
                          <p className="mt-2 p-2 bg-muted/50 rounded border border-border/40">
                            <span className="text-muted-foreground">Admin Note:</span> {returnReq.admin_note}
                          </p>
                        )}
                        <p className="text-muted-foreground/60">Requested on {new Date(returnReq.created_at).toLocaleDateString()}</p>
                      </div>
                      {returnReq.status === "pending" && (
                        <div className="flex gap-2 pt-1">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="rounded-lg text-xs h-7" 
                            onClick={async () => {
                              try {
                                await updateReturnStatus.mutateAsync({
                                  returnId: returnReq.id,
                                  status: 'approved',
                                  admin_note: 'Return request approved by seller'
                                });
                                toast.success('Return request approved');
                              } catch (error) {
                                toast.error('Failed to approve return request');
                              }
                            }}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="rounded-lg text-xs h-7 text-destructive" 
                            onClick={async () => {
                              try {
                                await updateReturnStatus.mutateAsync({
                                  returnId: returnReq.id,
                                  status: 'rejected',
                                  admin_note: 'Return request rejected by seller'
                                });
                                toast.success('Return request rejected');
                              } catch (error) {
                                toast.error('Failed to reject return request');
                              }
                            }}
                          >
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                      {returnReq.status === "approved" && (
                        <Button 
                          size="sm" 
                          className="rounded-lg text-xs h-7" 
                          onClick={async () => {
                            const refundAmount = prompt('Enter refund amount:', returnReq.refund_amount || '0');
                            if (refundAmount) {
                              try {
                                await updateReturnStatus.mutateAsync({
                                  returnId: returnReq.id,
                                  status: 'refunded',
                                  refund_amount: refundAmount,
                                  admin_note: 'Refund processed by seller'
                                });
                                toast.success('Return marked as refunded');
                              } catch (error) {
                                toast.error('Failed to process refund');
                              }
                            }
                          }}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" /> Process Refund
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Timeline */}
            <div className="stat-card space-y-4">
              <h2 className="section-title flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Order Timeline</h2>
              <div className="max-h-[320px] overflow-y-auto pr-1">
                <OrderTimeline events={timeline} />
              </div>
            </div>

            {/* Add Tracking Update */}
            {selectedOrder.status !== "delivered" && selectedOrder.status !== "cancelled" && (
              <div className="stat-card space-y-4">
                <h2 className="section-title flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Add Tracking Update</h2>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select value={trackingStatus} onValueChange={(v) => setTrackingStatus(v as Order["status"] | "Note")}>
                      <SelectTrigger className="h-9 rounded-lg text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Note">Note (no status change)</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Message</Label>
                    <Textarea
                      placeholder="e.g. Package handed to courier, estimated delivery 2 days..."
                      value={trackingMessage}
                      onChange={(e) => setTrackingMessage(e.target.value)}
                      className="rounded-lg text-sm min-h-[70px] resize-none"
                    />
                  </div>
                  {!selectedOrder.trackingNumber && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tracking Number (optional)</Label>
                      <Input
                        placeholder="e.g. 1Z999AA10123456784"
                        value={trackingNumberInput}
                        onChange={(e) => setTrackingNumberInput(e.target.value)}
                        className="h-9 rounded-lg text-xs font-mono"
                      />
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full rounded-lg gap-2"
                    disabled={!trackingMessage.trim()}
                    onClick={addTrackingUpdate}
                  >
                    <Send className="h-3.5 w-3.5" /> Add Update
                  </Button>
                </div>
              </div>
            )}

            <div className="stat-card space-y-3">
              <h2 className="section-title flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Payment</h2>
              <div className="text-sm space-y-2.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="font-medium">{selectedOrder.paymentMethod}</span></div>
                <div className="flex justify-between items-center"><span className="text-muted-foreground">Status</span><span className={paymentClass[selectedOrder.payment]}>{selectedOrder.payment}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold">${selectedOrder.amount.toFixed(2)}</span></div>
              </div>
              {selectedOrder.payment === "Unpaid" && (
                <Button size="sm" variant="outline" className="w-full rounded-lg gap-2 mt-2" onClick={() => openPaymentDialog(selectedOrder.id)}>
                  <Banknote className="h-3.5 w-3.5" /> Mark as Paid
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }


  // Render all dialogs
  function renderDialogs() {
    const refundOrder = orders.find(o => o.id === refundDialog.orderId);

    return (
      <>
        {/* Status Update Dialog */}
        <Dialog open={statusDialog.open} onOpenChange={(open) => !open && setStatusDialog(s => ({ ...s, open: false }))}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <StatusIcon className="h-5 w-5 text-primary" />
                {currentStatusLabel.title}
              </DialogTitle>
              <DialogDescription>{currentStatusLabel.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-sm">Message <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea
                  placeholder={`e.g. ${statusDialog.targetStatus === "shipped" ? "Package shipped via USPS Priority..." : statusDialog.targetStatus === "cancelled" ? "Customer requested cancellation..." : "Order is being prepared..."}`}
                  value={statusDialog.message}
                  onChange={(e) => setStatusDialog(s => ({ ...s, message: e.target.value }))}
                  className="rounded-lg text-sm min-h-[80px] resize-none"
                />
              </div>
              {(statusDialog.targetStatus === "shipped" || statusDialog.targetStatus === "processing") && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Tracking Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    placeholder="e.g. 1Z999AA10123456784"
                    value={statusDialog.trackingNumber}
                    onChange={(e) => setStatusDialog(s => ({ ...s, trackingNumber: e.target.value }))}
                    className="rounded-lg text-sm font-mono"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-lg" onClick={() => setStatusDialog(s => ({ ...s, open: false }))}>Cancel</Button>
              <Button
                className="rounded-lg"
                variant={statusDialog.targetStatus === "cancelled" ? "destructive" : "default"}
                onClick={confirmStatusUpdate}
                disabled={updateOrderStatus.isPending}
              >
                {updateOrderStatus.isPending ? "Updating..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Confirmation Dialog */}
        <Dialog open={paymentDialog.open} onOpenChange={(open) => !open && setPaymentDialog(s => ({ ...s, open: false }))}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" />
                Confirm Payment
              </DialogTitle>
              <DialogDescription>Mark this order as paid. Select the payment method used.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-sm">Payment Method <span className="text-destructive">*</span></Label>
                <Select value={paymentDialog.paymentMethod} onValueChange={(v) => setPaymentDialog(s => ({ ...s, paymentMethod: v }))}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Select payment method..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea
                  placeholder="e.g. Payment received via bank transfer, reference #12345..."
                  value={paymentDialog.description}
                  onChange={(e) => setPaymentDialog(s => ({ ...s, description: e.target.value }))}
                  className="rounded-lg text-sm min-h-[80px] resize-none"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-lg" onClick={() => setPaymentDialog(s => ({ ...s, open: false }))}>Cancel</Button>
              <Button className="rounded-lg" onClick={confirmPayment} disabled={!paymentDialog.paymentMethod}>Confirm Payment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ReceiptDialog
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          order={receiptOrder}
          shopName={currentShop?.name || "Flypick"}
          shopId={selectedShopId}
          defaultSender={receiptSender}
          defaultSenderFields={receiptSenderFields}
        />

        {/* Return / Refund Dialog */}
        <Dialog open={refundDialog.open} onOpenChange={(open) => !open && setRefundDialog(s => ({ ...s, open: false }))}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-primary" />
                Return & Refund
              </DialogTitle>
              <DialogDescription>Process a return or refund for this order.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              {/* Refund Type */}
              <div className="space-y-1.5">
                <Label className="text-sm">Refund Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`p-3 rounded-lg border text-sm font-medium text-left transition-colors ${refundDialog.type === "full" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"}`}
                    onClick={() => setRefundDialog(s => ({ ...s, type: "full", refundAmount: "" }))}
                  >
                    <div className="font-semibold">Full Refund</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Refund entire amount{refundOrder ? ` ($${refundOrder.amount.toFixed(2)})` : ""}
                    </div>
                  </button>
                  <button
                    className={`p-3 rounded-lg border text-sm font-medium text-left transition-colors ${refundDialog.type === "partial" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"}`}
                    onClick={() => setRefundDialog(s => ({ ...s, type: "partial" }))}
                  >
                    <div className="font-semibold">Partial Refund</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Refund specific amount or items</div>
                  </button>
                </div>
              </div>

              {/* Partial: amount + item selection */}
              {refundDialog.type === "partial" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Refund Amount <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={refundOrder?.amount}
                        placeholder="0.00"
                        value={refundDialog.refundAmount}
                        onChange={(e) => setRefundDialog(s => ({ ...s, refundAmount: e.target.value }))}
                        className="rounded-lg pl-7 text-sm"
                      />
                    </div>
                    {refundOrder && <p className="text-xs text-muted-foreground">Max: ${refundOrder.amount.toFixed(2)}</p>}
                  </div>
                  {refundOrder && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">Select Items to Return <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <div className="space-y-2">
                        {refundOrder.items.map((item, i) => (
                          <label key={i} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${refundDialog.selectedItems[i] ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                            <input
                              type="checkbox"
                              checked={!!refundDialog.selectedItems[i]}
                              onChange={(e) => setRefundDialog(s => ({
                                ...s,
                                selectedItems: { ...s.selectedItems, [i]: e.target.checked }
                              }))}
                              className="rounded border-border"
                            />
                            <div className="h-8 w-8 rounded-lg bg-muted/50 overflow-hidden shrink-0">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">N/A</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              <p className="text-xs text-muted-foreground">x{item.qty} • ${item.price.toFixed(2)}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Reason */}
              <div className="space-y-1.5">
                <Label className="text-sm">Reason <span className="text-destructive">*</span></Label>
                <Select value={refundDialog.reason} onValueChange={(v) => setRefundDialog(s => ({ ...s, reason: v }))}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Select reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    {REFUND_REASONS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-sm">Additional Details <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea
                  placeholder="Describe the issue in detail..."
                  value={refundDialog.description}
                  onChange={(e) => setRefundDialog(s => ({ ...s, description: e.target.value }))}
                  className="rounded-lg text-sm min-h-[80px] resize-none"
                />
              </div>

              {/* Summary */}
              <div className="bg-muted/30 rounded-lg p-3 border border-border/40">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Refund Summary</p>
                <div className="flex justify-between text-sm">
                  <span>Type</span>
                  <span className="font-medium capitalize">{refundDialog.type} Refund</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Amount</span>
                  <span className="font-bold text-destructive">
                    ${refundDialog.type === "full"
                      ? (refundOrder?.amount || 0).toFixed(2)
                      : (parseFloat(refundDialog.refundAmount) || 0).toFixed(2)
                    }
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-lg" onClick={() => setRefundDialog(s => ({ ...s, open: false }))}>Cancel</Button>
              <Button variant="destructive" className="rounded-lg" onClick={confirmRefund} disabled={!refundDialog.reason}>
                <RotateCcw className="h-4 w-4 mr-1.5" /> Process Refund
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }


  // List view
  return (
    <div className="space-y-6 animate-fade-in">
      {renderDialogs()}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header !mb-0">
          <h1>Orders</h1>
          <p>Manage and track all customer orders</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-lg"><Download className="h-4 w-4 mr-1.5" /> Export CSV</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShoppingCart} label="Total Orders" value={stats.total} accent="from-primary/10 to-primary/5" />
        <StatCard icon={DollarSign} label="Total Revenue" value={`$${stats.revenue.toFixed(0)}`} accent="from-success/10 to-success/5" />
        <StatCard icon={Clock} label="Pending" value={stats.pending} accent="from-warning/10 to-warning/5" />
        <StatCard icon={CheckCircle} label="Delivered" value={stats.delivered} accent="from-info/10 to-info/5" />
      </div>

      {/* Tabs */}
      <div className="border-b border-border overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={`relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${statusFilter === tab.key
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {tab.label}
              {tabCounts[tab.key] > 0 && tab.key !== "all" && (
                <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusFilter === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                  {tabCounts[tab.key]}
                </span>
              )}
              {statusFilter === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by order ID, name, or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10 rounded-lg" />
        </div>
        <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px] rounded-lg">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            {["Paid", "Unpaid", "Refunded"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Order Cards */}
      <div className="space-y-4">
        {paged.length === 0 ? (
          <div className="stat-card text-center py-16">
            <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">No orders found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your filters</p>
          </div>
        ) : paged.map((order) => (
          <div
            key={order.id}
            className="stat-card cursor-pointer hover:border-primary/30 transition-all group"
            onClick={() => setSelectedOrder(order)}
          >
            {/* Card Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-muted-foreground">Order Number:</span>
                <span className="font-bold font-mono text-sm">{order.id}</span>
                <button
                  className="text-muted-foreground hover:text-primary transition-colors"
                  onClick={(e) => { e.stopPropagation(); copyToClipboard(order.id); }}
                >
                  <FileText className="h-3.5 w-3.5" />
                </button>
              </div>
              <CountdownTimer deadlineDate={order.deadlineDate} status={order.status} />
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className={paymentClass[order.payment]}>{order.payment}</span>
              <span className={orderStatusClass[order.status]}>{order.status}</span>
              {order.notes && (
                <Badge variant="outline" className="text-[10px] font-medium border-warning/40 text-warning">Note</Badge>
              )}
              {returnRequests && returnRequests.some(r => r.order_id === order.id) && (
                <Badge variant="outline" className="text-[10px] font-medium border-destructive/40 text-destructive">
                  <RotateCcw className="h-2.5 w-2.5 mr-1" /> Return Request
                </Badge>
              )}
            </div>

            {/* Items Preview */}
            <div className="bg-muted/30 rounded-xl border border-border/40 p-3 mb-3 space-y-2">
              {order.items.slice(0, 2).map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-lg bg-muted/60 overflow-hidden shrink-0">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">No image</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">x {item.qty}</p>
                  </div>
                </div>
              ))}
              {order.items.length > 2 && (
                <p className="text-xs text-muted-foreground pl-14">+{order.items.length - 2} more item{order.items.length - 2 > 1 ? "s" : ""}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">Total Purchase</span>
                  <span className="font-bold text-base">${order.amount.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{order.date}</span>
                  <span className="mx-0.5">•</span>
                  <span>{order.customer}</span>
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {renderDocumentMenu(order, true)}
                {order.payment === "Unpaid" && (
                  <Button size="sm" variant="outline" className="rounded-lg text-xs h-8" onClick={() => openPaymentDialog(order.id)}>
                    <Banknote className="h-3.5 w-3.5 mr-1" /> Pay
                  </Button>
                )}
                {order.status === "pending" && order.payment !== "Unpaid" && (
                  <Button size="sm" variant="outline" className="rounded-lg text-xs h-8" onClick={() => openStatusDialog(order.id, "processing")}>
                    Process
                  </Button>
                )}
                {order.status === "processing" && (
                  <Button size="sm" className="rounded-lg text-xs h-8" onClick={() => openStatusDialog(order.id, "shipped")}>
                    <Truck className="h-3.5 w-3.5 mr-1" /> Ship
                  </Button>
                )}
                {order.status === "shipped" && (
                  <Button size="sm" className="rounded-lg text-xs h-8" onClick={() => openStatusDialog(order.id, "delivered")}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Deliver
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSelectedOrder(order)}><Eye className="h-4 w-4 mr-2" /> View Details</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {order.payment === "Unpaid" && (
                      <DropdownMenuItem onClick={() => openPaymentDialog(order.id)}><Banknote className="h-4 w-4 mr-2" /> Mark Paid</DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => openStatusDialog(order.id, "processing")}><Clock className="h-4 w-4 mr-2" /> Mark Processing</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openStatusDialog(order.id, "shipped")}><Truck className="h-4 w-4 mr-2" /> Mark Shipped</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openStatusDialog(order.id, "delivered")}><CheckCircle className="h-4 w-4 mr-2" /> Mark Delivered</DropdownMenuItem>
                    {order.status === "delivered" && order.payment !== "Refunded" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openRefundDialog(order.id)}><RotateCcw className="h-4 w-4 mr-2" /> Return / Refund</DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => openStatusDialog(order.id, "cancelled")}><XCircle className="h-4 w-4 mr-2" /> Cancel Order</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} orders
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page === 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => (
              <Button key={i} variant={page === i + 1 ? "default" : "outline"} size="icon" className="h-8 w-8 rounded-lg text-xs" onClick={() => setPage(i + 1)}>
                {i + 1}
              </Button>
            ))}
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Footer text */}
      {filtered.length > 0 && paged.length === filtered.length && (
        <p className="text-center text-sm text-muted-foreground py-4">No more data</p>
      )}
    </div>
  );
}

