import { useMemo, useState } from "react";
import { Ban, Download, Eye, Mail, MoreHorizontal, Search } from "lucide-react";

import { useCustomers } from "@/hooks/useCustomers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CustomerProfileModal from "@/components/CustomerProfileModal";

export default function Customers() {
  const { data: customers = [], isLoading } = useCustomers();
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  const filtered = useMemo(
    () =>
      customers.filter(
        (customer) =>
          customer.name.toLowerCase().includes(search.toLowerCase()) ||
          customer.email.toLowerCase().includes(search.toLowerCase())
      ),
    [customers, search]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header !mb-0">
          <h1>Customers</h1>
          <p>{customers.length} registered customers</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-lg">
          <Download className="h-4 w-4 mr-1.5" /> Export
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 rounded-lg"
        />
      </div>

      {isLoading ? (
        <div className="stat-card py-10 text-center text-muted-foreground">Loading customers...</div>
      ) : (
        <div className="stat-card overflow-x-auto p-0">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="pl-5">Customer</th>
                <th>Orders</th>
                <th>Total Spent</th>
                <th>Joined</th>
                <th>Status</th>
                <th className="w-10 pr-5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr key={customer.id}>
                  <td className="pl-5">
                    <div
                      className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setSelectedCustomerId(customer.id)}
                    >
                      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/10 to-accent flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {customer.name[0]?.toUpperCase() ?? "C"}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-muted-foreground">{customer.orders}</td>
                  <td className="font-semibold">${Number(customer.spent || 0).toFixed(2)}</td>
                  <td className="text-muted-foreground">{customer.joined || "-"}</td>
                  <td>
                    <span
                      className={
                        customer.status === "Active"
                          ? "status-badge status-badge--success"
                          : "status-badge status-badge--destructive"
                      }
                    >
                      {customer.status}
                    </span>
                  </td>
                  <td className="pr-5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedCustomerId(customer.id)}>
                          <Eye className="h-4 w-4 mr-2" /> View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Mail className="h-4 w-4 mr-2" /> Send Email
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Ban className="h-4 w-4 mr-2" /> Block
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="pl-5 py-8 text-muted-foreground" colSpan={6}>
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <CustomerProfileModal
        customerId={selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
      />
    </div>
  );
}

