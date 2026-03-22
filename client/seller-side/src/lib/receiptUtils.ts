export interface ReceiptOrder {
  id: string;
  apiId: number;
  customer: string;
  email: string;
  phone: string;
  items: Array<{ name: string; sku: string; qty: number; price: number; imageUrl?: string }>;
  amount: number;
  subtotal?: number;
  shippingCost?: number;
  discount?: number;
  status: string;
  payment: string;
  paymentMethod: string;
  date: string;
  address: { street: string; city: string; state: string; zip: string; country: string };
  trackingNumber?: string;
  notes?: string;
}

export interface SenderDetails {
  name: string;
  phone: string;
  address: string;
  email?: string;
}

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(value) ? value : 0);

const clean = (value?: string | null) => {
  const trimmed = (value || "").trim();
  return trimmed && trimmed !== "-" ? trimmed : "";
};

const esc = (value: string) =>
  (value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));

const subtotal = (order: ReceiptOrder) => {
  if (typeof order.subtotal === "number" && Number.isFinite(order.subtotal)) {
    return Math.max(order.subtotal, 0);
  }
  return order.items.reduce((sum, item) => sum + item.qty * item.price, 0);
};
const shipping = (order: ReceiptOrder) => {
  if (typeof order.shippingCost === "number") {
    return Math.max(order.shippingCost, 0);
  }
  return Math.max(order.amount - subtotal(order), 0);
};

function shell(title: string, css: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500;700&display=swap');
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; color: #0f172a; background: #f8fafc; }
    ${css}
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
}

export function buildThermalReceipt(order: ReceiptOrder, shopName: string, _sender?: SenderDetails) {
  const rows = order.items
    .map(
      (item) => `
      <tr>
        <td><strong>${esc(item.name)}</strong><span class="sku">${esc(item.sku)}</span></td>
        <td class="right">${item.qty}</td>
        <td class="right">${money(item.qty * item.price)}</td>
      </tr>`
    )
    .join("");

  return shell(
    `Receipt ${order.id}`,
    `
    @page { size: A4 portrait; margin: 15mm 20mm; }
    body { background: #f8fafc; color: #000; }
    .page-wrapper { display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; padding: 20px 0; }
    .page { width: 100%; max-width: 420px; background: #fff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10mm 8mm; font-family: 'JetBrains Mono', monospace; font-size: 11pt; }
    .center { text-align: center; }
    .section { padding: 4mm 0; margin-bottom: 3mm; border-bottom: 1px dashed #9ca3af; }
    .brand { font-size: 22pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtle { color: #52525b; font-size: 9pt; }
    .row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 2mm; font-size: 11pt; }
    .grand { padding-top: 3mm; border-top: 2px solid #000; font-size: 13pt; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 2.5mm 0; text-align: left; vertical-align: top; }
    th { border-bottom: 1px solid #000; color: #52525b; font-size: 9pt; text-transform: uppercase; }
    td { border-bottom: 1px dotted #d4d4d8; font-size: 11pt; }
    .sku { display: block; margin-top: 1mm; color: #71717a; font-size: 8.5pt; }
    .right { text-align: right; white-space: nowrap; }
    @media print {
      body { background: #fff; }
      .page-wrapper { min-height: unset; padding: 0; }
      .page { border: none; max-width: 100%; }
    }
    `,
    `
    <div class="page-wrapper">
    <main class="page">
      <section class="section center">
        <div class="brand">${esc(shopName || "Flypick")}</div>
        <div class="subtle">Sales Receipt</div>
      </section>
      <section class="section">
        <div class="row"><span>Order</span><strong>${esc(order.id)}</strong></div>
        <div class="row"><span>Date</span><strong>${esc(order.date)}</strong></div>
        <div class="row"><span>Payment</span><strong>${esc(order.payment)}</strong></div>
        <div class="row"><span>Method</span><strong>${esc(order.paymentMethod)}</strong></div>
      </section>
      <section class="section">
        <div>${esc(order.customer)}</div>
        <div class="subtle">${esc(order.email)}</div>
        ${clean(order.phone) ? `<div class="subtle">${esc(order.phone)}</div>` : ""}
      </section>
      <section class="section">
        <table>
          <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
      <section class="section">
        <div class="row"><span>Subtotal</span><strong>${money(subtotal(order))}</strong></div>
        <div class="row"><span>Shipping</span><strong>${money(shipping(order))}</strong></div>
        <div class="row grand"><span>Total</span><strong>${money(order.amount)}</strong></div>
      </section>
      <div class="center subtle">Keep this receipt for your records.</div>
    </main>
    </div>`
  );
}

export function buildA4Invoice(order: ReceiptOrder, shopName: string, _sender?: SenderDetails) {
  const rows = order.items
    .map(
      (item, index) => `
      <tr class="${index % 2 === 0 ? "even" : "odd"}">
        <td><div class="item-name">${esc(item.name)}</div><div class="item-sku">${esc(item.sku)}</div></td>
        <td class="center">${item.qty}</td>
        <td class="right">${money(item.price)}</td>
        <td class="right strong">${money(item.qty * item.price)}</td>
      </tr>`
    )
    .join("");

  return shell(
    `Invoice ${order.id}`,
    `
    @page { size: A4; margin: 14mm 16mm; }
    .page { max-width: 180mm; margin: 0 auto; background: #fff; }
    .header { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin-bottom: 8mm; padding-bottom: 6mm; border-bottom: 2px solid #0f172a; }
    .brand { font-family: 'Fraunces', serif; font-size: 26pt; margin: 0 0 1mm; line-height: 1; }
    .muted { color: #64748b; }
    .meta { text-align: right; }
    .tag { display: inline-block; padding: 2mm 5mm; border-radius: 2mm; background: #0f172a; color: #fff; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 6mm; margin-top: 3mm; }
    .meta-grid span, .label { display: block; color: #94a3b8; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.5mm; }
    .meta-grid strong { font-family: 'JetBrains Mono', monospace; font-size: 10pt; }
    .chips { display: flex; gap: 2mm; flex-wrap: wrap; margin-bottom: 6mm; }
    .chip { display: inline-flex; align-items: center; padding: 1.5mm 4mm; border: 1px solid #cbd5e1; border-radius: 999px; background: #fff; color: #334155; font-size: 8pt; font-weight: 600; }
    .chip-dark { background: #0f172a; color: #fff; border-color: #0f172a; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #0f172a; }
    th { color: #fff; padding: 3mm 4mm; text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.08em; }
    td { padding: 3.5mm 4mm; border-bottom: 1px solid #e2e8f0; }
    .even { background: #fff; }
    .odd { background: #f8fafc; }
    .item-name { font-weight: 600; }
    .item-sku { color: #94a3b8; font-family: 'JetBrains Mono', monospace; font-size: 8pt; margin-top: 0.5mm; }
    .center { text-align: center; }
    .right { text-align: right; }
    .strong { font-weight: 700; }
    .totals-wrap { display: flex; justify-content: flex-end; margin-top: 5mm; }
    .totals { min-width: 72mm; border: 1px solid #e2e8f0; border-radius: 3mm; overflow: hidden; }
    .totals div { display: flex; justify-content: space-between; padding: 2.5mm 5mm; border-bottom: 1px solid #e2e8f0; }
    .totals .grand { background: #0f172a; color: #fff; font-size: 12pt; font-weight: 700; border-bottom: 0; }
    .notes { margin-top: 5mm; border: 1px solid #fde68a; background: #fffbeb; border-radius: 3mm; padding: 4mm 5mm; color: #78350f; }
    .footer { display: flex; justify-content: space-between; gap: 16px; margin-top: 8mm; padding-top: 5mm; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 8.5pt; }
    .signature { min-width: 60mm; text-align: right; border-top: 1px solid #cbd5e1; padding-top: 2mm; margin-top: 10mm; }
    `,
    `
    <main class="page">
      <header class="header">
        <div><h1 class="brand">${esc(shopName || "Flypick")}</h1><div class="muted">Official Sales Invoice</div></div>
        <div class="meta">
          <div class="tag">Invoice</div>
          <div class="meta-grid">
            <div><span>Invoice #</span><strong>${esc(order.id)}</strong></div>
            <div><span>Date</span><strong>${esc(order.date)}</strong></div>
            <div><span>Payment</span><strong>${esc(order.payment)}</strong></div>
            <div><span>Method</span><strong>${esc(order.paymentMethod)}</strong></div>
          </div>
        </div>
      </header>
      <section class="chips">
        <span class="chip chip-dark">${esc(order.payment)}</span>
        <span class="chip">${esc(order.paymentMethod)}</span>
        ${clean(order.trackingNumber) ? `<span class="chip">Tracking: ${esc(order.trackingNumber || "")}</span>` : ""}
      </section>
      <table>
        <thead><tr><th>Item</th><th class="center">Qty</th><th class="right">Unit Price</th><th class="right">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <section class="totals-wrap">
        <div class="totals">
          <div><span>Subtotal</span><strong>${money(subtotal(order))}</strong></div>
          <div><span>Shipping</span><strong>${money(shipping(order))}</strong></div>
          <div class="grand"><span>Total</span><strong>${money(order.amount)}</strong></div>
        </div>
      </section>
      ${clean(order.notes) ? `<section class="notes"><div class="label">Order Notes</div><div>${esc(order.notes || "")}</div></section>` : ""}
      <footer class="footer"><div>Thank you for your order.</div><div class="signature">Authorized Signature</div></footer>
    </main>`
  );
}

export function buildShippingLabel(order: ReceiptOrder, shopName: string, sender: SenderDetails, receiver?: { name: string; phone: string; address: string }) {
  const senderLines = [clean(sender.name), clean(sender.phone), ...clean(sender.address).split(/\r?\n/).map(clean), clean(sender.email)].filter(Boolean);
  const receiverLines = receiver
    ? [clean(receiver.name), clean(receiver.phone), ...clean(receiver.address).split(/\r?\n/).map(clean)].filter(Boolean)
    : [clean(order.customer), clean(order.phone), clean(order.address.street), [clean(order.address.city), clean(order.address.state), clean(order.address.zip)].filter(Boolean).join(", "), clean(order.address.country)].filter(Boolean);
  const items = order.items.reduce((sum, item) => sum + item.qty, 0);

  return shell(
    `Shipping Label ${order.id}`,
    `
    @page { size: A5 landscape; margin: 8mm; }
    body { background: #fff; }
    .page { min-height: calc(148mm - 16mm); display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: auto 1fr auto; border: 2.5pt solid #000; border-radius: 3mm; overflow: hidden; }
    .topbar { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr auto 1fr; gap: 4mm; align-items: center; padding: 3mm 5mm; background: #0f172a; color: #fff; }
    .shop { font-size: 14pt; font-weight: 800; }
    .badge { justify-self: center; font-size: 8pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 1.5mm 4mm; border-radius: 2mm; background: rgba(255,255,255,0.16); }
    .order { text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 11pt; font-weight: 700; }
    .panel { padding: 5mm; border-bottom: 1pt solid #e2e8f0; }
    .panel-muted { background: #f8fafc; border-right: 2pt dashed #94a3b8; }
    .label { color: #64748b; font-size: 7.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2mm; }
    .name { font-size: 16pt; font-weight: 800; line-height: 1.2; margin-bottom: 2mm; }
    .name-large { font-size: 20pt; }
    .copy { color: #334155; font-size: 10pt; line-height: 1.6; }
    .copy-large { font-size: 12pt; }
    .footer { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr auto; gap: 4mm; align-items: center; padding: 4mm 5mm; background: #f8fafc; border-top: 1pt solid #e2e8f0; }
    .track { font-family: 'JetBrains Mono', monospace; font-size: 15pt; font-weight: 700; }
    .chips { display: flex; gap: 2mm; flex-wrap: wrap; justify-content: flex-end; }
    .chip { display: inline-flex; align-items: center; padding: 1.5mm 3.5mm; border-radius: 999px; border: 1pt solid #cbd5e1; background: #fff; color: #334155; font-size: 8pt; font-weight: 600; }
    .chip-dark { background: #0f172a; color: #fff; border-color: #0f172a; }
    `,
    `
    <main class="page">
      <header class="topbar"><div class="shop">${esc(shopName || "Flypick")}</div><div class="badge">Shipping Label</div><div class="order">${esc(order.id)}</div></header>
      <section class="panel panel-muted"><div class="label">Sender / Return Address</div><div class="name">${esc(senderLines[0] || shopName || "Flypick")}</div><div class="copy">${senderLines.slice(1).map(esc).join("<br />")}</div></section>
      <section class="panel"><div class="label">Deliver To</div><div class="name name-large">${esc(receiverLines[0] || order.customer)}</div><div class="copy copy-large">${receiverLines.slice(1).map(esc).join("<br />")}</div></section>
      <footer class="footer">
        <div><div class="label">Tracking Number</div><div class="track">${esc(clean(order.trackingNumber) || "PENDING")}</div></div>
        <div class="chips">
          <span class="chip chip-dark">${esc(order.payment)}</span>
          <span class="chip">${esc(order.status)}</span>
          <span class="chip">${items} item${items === 1 ? "" : "s"}</span>
          <span class="chip chip-dark">${money(order.amount)}</span>
        </div>
      </footer>
    </main>`
  );
}

export function buildPackingSlip(order: ReceiptOrder, shopName: string, sender?: SenderDetails) {
  const address = [clean(order.address.street), [clean(order.address.city), clean(order.address.state), clean(order.address.zip)].filter(Boolean).join(", "), clean(order.address.country)]
    .filter(Boolean)
    .map(esc)
    .join("<br />");
  const units = order.items.reduce((sum, item) => sum + item.qty, 0);
  const rows = order.items
    .map(
      (item) => `
      <tr>
        <td><div class="item-name">${esc(item.name)}</div><div class="item-sku">SKU: ${esc(item.sku)}</div></td>
        <td class="center">${item.qty}</td>
        <td class="center">[ ]</td>
      </tr>`
    )
    .join("");

  return shell(
    `Packing Slip ${order.id}`,
    `
    @page { size: A5; margin: 10mm; }
    body { background: #fff; }
    .header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding-bottom: 4mm; border-bottom: 2pt solid #0f172a; margin-bottom: 5mm; }
    .shop { font-size: 18pt; font-weight: 800; line-height: 1; }
    .muted { color: #64748b; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
    .meta { text-align: right; }
    .order { font-family: 'JetBrains Mono', monospace; font-size: 13pt; font-weight: 700; }
    .date { color: #64748b; font-size: 8.5pt; margin-top: 1mm; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 5mm; }
    .box { background: #f8fafc; border: 1pt solid #e2e8f0; border-radius: 2mm; padding: 3mm 4mm; }
    .label { color: #94a3b8; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1mm; }
    .value { font-size: 10pt; font-weight: 600; }
    .copy { color: #64748b; font-size: 8.5pt; line-height: 1.5; margin-top: 1mm; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { border-bottom: 2pt solid #0f172a; }
    th, td { padding: 2.5mm 2mm 2.5mm 0; border-bottom: 0.5pt solid #e2e8f0; text-align: left; vertical-align: top; }
    th { font-size: 8pt; text-transform: uppercase; color: #334155; }
    .item-name { font-weight: 600; }
    .item-sku { color: #94a3b8; font-family: 'JetBrains Mono', monospace; font-size: 8pt; margin-top: 0.5mm; }
    .center { text-align: center; }
    .track { margin-top: 4mm; padding: 3mm 4mm; background: #eff6ff; border: 1pt solid #bfdbfe; border-radius: 2mm; font-size: 9pt; }
    .footer { margin-top: 5mm; padding-top: 3mm; border-top: 1pt dashed #cbd5e1; text-align: center; color: #94a3b8; font-size: 8pt; }
    `,
    `
    <main>
      <header class="header"><div><div class="shop">${esc(shopName || "Flypick")}</div><div class="muted">Packing Slip</div></div><div class="meta"><div class="order">${esc(order.id)}</div><div class="date">${esc(order.date)}</div></div></header>
      <section class="grid">
        <article class="box"><div class="label">Seller</div><div class="value">${esc(clean(sender?.name) || shopName || "Flypick")}</div><div class="copy">${sender && (clean(sender?.phone) || clean(sender?.address) || clean(sender?.email)) ? [clean(sender?.phone), ...clean(sender?.address).split(/\r?\n/).map(clean), clean(sender?.email)].filter(Boolean).map(esc).join("<br />") : "Powered by Flypick Marketplace"}</div></article>
        <article class="box"><div class="label">Ship To</div><div class="value">${esc(order.customer)}</div><div class="copy">${address}</div></article>
      </section>
      <div class="muted" style="margin-bottom:2mm">Items to Pack (${order.items.length} lines / ${units} units)</div>
      <table><thead><tr><th>Item</th><th class="center">Qty</th><th class="center">Packed</th></tr></thead><tbody>${rows}</tbody></table>
      ${clean(order.trackingNumber) ? `<div class="track"><strong>Tracking:</strong> ${esc(order.trackingNumber || "")}</div>` : ""}
      <footer class="footer">${esc(shopName || "Flypick")} / Order ${esc(order.id)} / ${esc(order.date)}</footer>
    </main>`
  );
}

export function openDocWindow(html: string) {
  const objectUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const iframe = document.createElement("iframe");

  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  const cleanup = () => {
    window.setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(objectUrl);
    }, 1000);
  };

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      cleanup();
      window.alert("Print preview could not be opened.");
      return;
    }

    const handleAfterPrint = () => {
      frameWindow.removeEventListener("afterprint", handleAfterPrint);
      cleanup();
    };

    frameWindow.addEventListener("afterprint", handleAfterPrint);
    frameWindow.focus();
    window.setTimeout(() => {
      frameWindow.print();
      window.setTimeout(cleanup, 15000);
    }, 250);
  };

  iframe.src = objectUrl;
  document.body.appendChild(iframe);
}

export function downloadDoc(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
