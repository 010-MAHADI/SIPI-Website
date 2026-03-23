import { Link } from "react-router-dom";
import { RotateCcw, Package, ChevronRight } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useReturns, ReturnRequest } from "@/hooks/useReturns";
import TakaSign from "@/components/TakaSign";

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  approved: "bg-primary/10 text-primary border-primary/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  refunded: "bg-green-500/10 text-green-600 border-green-500/20",
};

const Returns = () => {
  const { data: returns = [], isLoading } = useReturns();

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="max-w-[900px] mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-4">Return Requests</h1>

        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Loading returns...</p>
          </div>
        ) : returns.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <RotateCcw className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">No return requests</h2>
            <p className="text-muted-foreground text-sm mb-6">
              You haven't submitted any return requests yet.
            </p>
            <Link to="/orders" className="inline-block bg-primary text-primary-foreground font-bold px-8 py-3 rounded-lg hover:opacity-90 text-sm">
              View Orders
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {returns.map((ret) => (
              <ReturnCard key={ret.id} returnReq={ret} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

const ReturnCard = ({ returnReq }: { returnReq: ReturnRequest }) => {
  const style = statusStyles[returnReq.status] || "bg-muted text-muted-foreground";

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">Return #{returnReq.return_id}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Order: {returnReq.order_id} · {new Date(returnReq.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border capitalize ${style}`}>
          {returnReq.status}
        </span>
      </div>

      <p className="text-sm text-muted-foreground mb-2">
        <span className="font-medium text-foreground">Reason:</span> {returnReq.reason}
      </p>

      {returnReq.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{returnReq.description}</p>
      )}

      {returnReq.refund_amount && returnReq.status === "refunded" && (
        <p className="text-sm font-bold text-[hsl(var(--success))]">
          Refunded: <TakaSign />{parseFloat(returnReq.refund_amount).toLocaleString()}
        </p>
      )}

      {returnReq.admin_note && (
        <div className="mt-2 p-2 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground"><span className="font-medium">Note:</span> {returnReq.admin_note}</p>
        </div>
      )}

      {returnReq.items && returnReq.items.length > 0 && (
        <div className="mt-3 space-y-2">
          {returnReq.items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2">
              <div className="w-10 h-10 rounded bg-muted overflow-hidden flex-shrink-0 border border-border">
                <img src={item.product_image || "/placeholder.svg"} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium line-clamp-1">{item.product_title}</p>
                <p className="text-[10px] text-muted-foreground">Qty: {item.quantity}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Returns;
