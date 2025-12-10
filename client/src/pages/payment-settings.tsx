import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { isUnauthorizedError } from "../lib/authUtils";
import { Link } from "wouter";
import { useCreatorPageTour } from "../components/CreatorTour";
import { CREATOR_TOUR_IDS, paymentSettingsTourSteps as creatorPaymentTourSteps } from "../lib/creatorTourConfig";
import { useCompanyPageTour } from "../components/CompanyTour";
import { COMPANY_TOUR_IDS, paymentSettingsTourSteps as companyPaymentTourSteps } from "../lib/companyTourConfig";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  Filter,
  Info,
  Search,
  Send,
  Trash2,
  TrendingUp,
  Users,
  X,
  XCircle,
} from "lucide-react";

import type { User } from "../../../shared/schema";
import { TopNavBar } from "../components/TopNavBar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";

type PaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "refunded";

type CreatorPayment = {
  id: string;
  offerId: string;
  companyId: string;
  grossAmount: string;
  platformFeeAmount: string;
  stripeFeeAmount: string;
  netAmount: string;
  status: PaymentStatus;
  paymentMethod?: string;
  description?: string;
  completedAt?: string;
  createdAt: string;
};

type PaymentMethod = {
  id: number;
  payoutMethod: string;
  payoutEmail?: string;
  bankRoutingNumber?: string;
  bankAccountNumber?: string;
  paypalEmail?: string;
  cryptoWalletAddress?: string;
  cryptoNetwork?: string;
  stripeAccountId?: string;
  isDefault?: boolean;
};

type AdminFundingMethod = {
  id: number;
  name: string;
  type: "bank" | "wallet" | "card";
  last4: string;
  status: "active" | "pending" | "disabled";
  isPrimary?: boolean;
};

const statusConfig: Record<PaymentStatus, { bg: string; text: string; icon: typeof Clock; label: string }> = {
  pending: { bg: "bg-yellow-100", text: "text-yellow-800", icon: Clock, label: "Pending" },
  processing: { bg: "bg-blue-100", text: "text-blue-800", icon: Clock, label: "Processing" },
  completed: { bg: "bg-green-100", text: "text-green-800", icon: CheckCircle, label: "Completed" },
  failed: { bg: "bg-red-100", text: "text-red-800", icon: XCircle, label: "Failed" },
  refunded: { bg: "bg-gray-100", text: "text-gray-800", icon: AlertTriangle, label: "Refunded" },
};

// Helper to check if a payment is disputed (failed with "Disputed:" in description)
function isDisputedPayment(payment: CreatorPayment): boolean {
  return payment.status === "failed" &&
    (payment.description?.toLowerCase().includes("disputed:") ?? false);
}

function StatusBadge({ status, isDisputed = false }: { status: PaymentStatus; isDisputed?: boolean }) {
  // Show disputed badge if payment is disputed
  if (isDisputed) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"
      >
        <AlertTriangle className="w-3 h-3" />
        Disputed
      </span>
    );
  }

  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function CreatorOverview({ payments }: { payments: CreatorPayment[] }) {
  const { toast } = useToast();
  const { totalEarnings, pendingEarnings, completedEarnings, processingEarnings, disputedEarnings } = useMemo(() => {
    const totals = payments.reduce(
      (acc, payment) => {
        const amount = parseFloat(payment.netAmount);
        const disputed = isDisputedPayment(payment);

        // Track disputed payments separately - do NOT include in total earnings
        if (disputed) {
          acc.disputedEarnings += amount;
          return acc; // Skip adding to totalEarnings
        }

        // Only add non-disputed payments to total earnings
        acc.totalEarnings += amount;

        if (payment.status === "completed") {
          acc.completedEarnings += amount;
        }
        if (payment.status === "pending") {
          acc.pendingEarnings += amount;
        }
        if (payment.status === "processing") {
          acc.processingEarnings += amount;
        }
        return acc;
      },
      { totalEarnings: 0, pendingEarnings: 0, completedEarnings: 0, processingEarnings: 0, disputedEarnings: 0 }
    );

    return totals;
  }, [payments]);

  const exportPayments = () => {
    const csv = [
      ['ID', 'Description', 'Gross', 'Platform Fee', 'Processing Fee', 'Net Amount', 'Status', 'Date'],
      ...payments.map(p => [
        p.id.slice(0, 8),
        p.description || 'Payment',
        p.grossAmount,
        p.platformFeeAmount,
        p.stripeFeeAmount,
        p.netAmount,
        p.status,
        p.completedAt || p.createdAt
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Payment history exported successfully",
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border-2 border-gray-200 bg-white p-6 space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Payout Status Breakdown</h3>
            <p className="text-sm text-gray-600">
              See where every creator payout sits: awaiting admin approval, processing, or fully paid.
            </p>
          </div>
          <Badge variant="outline" className="self-start border-green-200 bg-green-50 text-green-700">
            Total earnings ${totalEarnings.toFixed(2)}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50 p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-yellow-700">Pending Admin Approval</span>
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="text-3xl font-bold text-yellow-900">${pendingEarnings.toFixed(2)}</div>
            <div className="mt-1 text-xs text-yellow-700">Company approved, awaiting admin</div>
          </div>

          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-blue-700">Processing Payment</span>
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-blue-900">${processingEarnings.toFixed(2)}</div>
            <div className="mt-1 text-xs text-blue-700">Payment in progress</div>
          </div>

          <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Paid Out</span>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900">${completedEarnings.toFixed(2)}</div>
            <div className="mt-1 text-xs text-gray-500">Lifetime completed payouts</div>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-green-500 to-green-600 p-6 text-white">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-green-100">All Earnings</span>
              <DollarSign className="h-5 w-5 text-green-100" />
            </div>
            <div className="text-3xl font-bold">${totalEarnings.toFixed(2)}</div>
            <div className="mt-1 text-xs text-green-100">Including pending & processing</div>
          </div>

          {disputedEarnings > 0 && (
            <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-6 md:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-orange-700">Disputed</span>
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div className="text-3xl font-bold text-orange-900">${disputedEarnings.toFixed(2)}</div>
              <div className="mt-1 text-xs text-orange-700">Awaiting admin resolution</div>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Payment History</h3>
            <Button variant="outline" size="sm" onClick={exportPayments}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {payments.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500">No payment history yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Gross
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Platform Fee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Processing (3%)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Net Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {payments.map((payment) => (
                  <tr key={payment.id} className="transition hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {payment.id.slice(0, 8)}...
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {payment.description || "Payment"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      ${parseFloat(payment.grossAmount).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-red-600">
                      -${parseFloat(payment.platformFeeAmount).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-red-600">
                      -${parseFloat(payment.stripeFeeAmount).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-green-600">
                      ${parseFloat(payment.netAmount).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={payment.status} isDisputed={isDisputedPayment(payment)} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {payment.completedAt
                        ? new Date(payment.completedAt).toLocaleDateString()
                        : new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link href={`/payments/${payment.id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" />
                          View Details
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentMethodSettings({
  paymentMethods,
  payoutMethod,
  setPayoutMethod,
  payoutEmail,
  setPayoutEmail,
  bankRoutingNumber,
  setBankRoutingNumber,
  bankAccountNumber,
  setBankAccountNumber,
  paypalEmail,
  setPaypalEmail,
  cryptoWalletAddress,
  setCryptoWalletAddress,
  cryptoNetwork,
  setCryptoNetwork,
  onAddPaymentMethod,
  onDeletePaymentMethod,
  onSetPrimary,
  onUpgradeETransfer,
  isSubmitting,
  title = "Payment Methods",
  emptyDescription = "Add a payment method to receive payouts",
  showFeeBreakdown = true,
}: {
  paymentMethods?: PaymentMethod[];
  payoutMethod: string;
  setPayoutMethod: (method: string) => void;
  payoutEmail: string;
  setPayoutEmail: (value: string) => void;
  bankRoutingNumber: string;
  setBankRoutingNumber: (value: string) => void;
  bankAccountNumber: string;
  setBankAccountNumber: (value: string) => void;
  paypalEmail: string;
  setPaypalEmail: (value: string) => void;
  cryptoWalletAddress: string;
  setCryptoWalletAddress: (value: string) => void;
  cryptoNetwork: string;
  setCryptoNetwork: (value: string) => void;
  onAddPaymentMethod: () => void;
  onDeletePaymentMethod?: (method: PaymentMethod) => void;
  onSetPrimary?: (method: PaymentMethod) => void;
  onUpgradeETransfer?: (method: PaymentMethod) => void;
  isSubmitting: boolean;
  title?: string;
  emptyDescription?: string;
  showFeeBreakdown?: boolean;
}) {
  const isAddDisabled =
    isSubmitting ||
    (payoutMethod === "etransfer" && !payoutEmail) ||
    (payoutMethod === "wire" && (!bankRoutingNumber || !bankAccountNumber)) ||
    (payoutMethod === "paypal" && !paypalEmail) ||
    (payoutMethod === "crypto" && (!cryptoWalletAddress || !cryptoNetwork));

  const getDisplayValue = (method: PaymentMethod) => {
    if (method.payoutMethod === "etransfer") return method.payoutEmail;
    if (method.payoutMethod === "wire") return `****${method.bankAccountNumber?.slice(-4)}`;
    if (method.payoutMethod === "paypal") return method.paypalEmail;
    if (method.payoutMethod === "crypto") return `${method.cryptoWalletAddress?.slice(0, 6)}...`;
    return undefined;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {!paymentMethods || paymentMethods.length === 0 ? (
          <div className="mt-6 text-center">
            <DollarSign className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <p className="text-gray-600">No payment methods yet</p>
            <p className="mt-1 text-sm text-gray-500">{emptyDescription}</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {paymentMethods.map((method) => {
              const needsStripeSetup = method.payoutMethod === 'etransfer' && !method.stripeAccountId;

              return (
                <div
                  key={method.id}
                  className={`flex flex-col rounded-lg border-2 p-4 ${
                    needsStripeSetup ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <CreditCard className={`h-5 w-5 flex-shrink-0 ${needsStripeSetup ? 'text-yellow-600' : 'text-gray-400'}`} />
                      <div className="min-w-0">
                        <div className="font-medium capitalize text-gray-900 flex flex-wrap items-center gap-2">
                          {method.payoutMethod.replace("_", " ")}
                          {needsStripeSetup && (
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                              Setup Required
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 truncate">{getDisplayValue(method)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                      {method.isDefault ? (
                        <Badge>Default</Badge>
                      ) : (
                        onSetPrimary && !needsStripeSetup && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSetPrimary(method)}
                            className="text-sm whitespace-nowrap"
                          >
                            Set as Primary
                          </Button>
                        )
                      )}
                      {onDeletePaymentMethod && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeletePaymentMethod(method)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {needsStripeSetup && (
                    <div className="mt-3 pt-3 border-t border-yellow-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-sm text-yellow-800">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>Stripe Connect setup required to process payments</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => onUpgradeETransfer && onUpgradeETransfer(method)}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white w-full sm:w-auto"
                      >
                        Complete Setup
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
        <h3 className="text-lg font-bold text-gray-900">Add Payment Method</h3>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="method">Payout Method</Label>
            <Select value={payoutMethod} onValueChange={setPayoutMethod}>
              <SelectTrigger id="method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="etransfer">E-Transfer</SelectItem>
                <SelectItem value="wire">Wire/ACH</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="crypto">Cryptocurrency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {payoutMethod === "etransfer" && (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={payoutEmail}
                onChange={(e) => setPayoutEmail(e.target.value)}
              />
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mt-2">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Payment Requirements:</p>
                    <p className="text-xs">E-Transfer payments via Stripe require a minimum transaction amount of <strong>$1.00 CAD</strong>. Payments below this amount cannot be processed.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {payoutMethod === "wire" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="routing">Bank Routing Number</Label>
                <Input
                  id="routing"
                  placeholder="123456789"
                  value={bankRoutingNumber}
                  onChange={(e) => setBankRoutingNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account">Bank Account Number</Label>
                <Input
                  id="account"
                  placeholder="123456789012"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                />
              </div>
            </>
          )}

          {payoutMethod === "paypal" && (
            <div className="space-y-2">
              <Label htmlFor="paypal-email">PayPal Email</Label>
              <Input
                id="paypal-email"
                type="email"
                placeholder="your@paypal.com"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
              />
            </div>
          )}

          {payoutMethod === "crypto" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="wallet">Wallet Address</Label>
                <Input
                  id="wallet"
                  placeholder="0x..."
                  value={cryptoWalletAddress}
                  onChange={(e) => setCryptoWalletAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="network">Network</Label>
                <Select value={cryptoNetwork} onValueChange={setCryptoNetwork}>
                  <SelectTrigger id="network">
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ethereum">Ethereum (ERC-20)</SelectItem>
                    <SelectItem value="bsc">Binance Smart Chain (BEP-20)</SelectItem>
                    <SelectItem value="polygon">Polygon (MATIC)</SelectItem>
                    <SelectItem value="bitcoin">Bitcoin</SelectItem>
                    <SelectItem value="tron">Tron (TRC-20)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <Button
            onClick={onAddPaymentMethod}
            disabled={isAddDisabled}
            className="w-full"
          >
            {isSubmitting ? "Adding..." : "Add Payment Method"}
          </Button>
        </div>
      </div>

      {showFeeBreakdown && (
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6">
          <h4 className="mb-2 font-bold text-blue-900">Payment Fee Breakdown</h4>
          <div className="space-y-2 text-sm text-blue-800">
            <div className="flex justify-between">
              <span>Platform Fee:</span>
              <span className="font-medium">Varies by company (default 4%)</span>
            </div>
            <div className="flex justify-between">
              <span>Processing Fee:</span>
              <span className="font-medium">3% of gross earnings</span>
            </div>
            <div className="mt-2 flex justify-between border-t-2 border-blue-300 pt-2 font-bold">
              <span>Total Deduction:</span>
              <span>Platform fee + 3% processing</span>
            </div>
            <p className="mt-2 text-xs text-blue-600">
              Note: Platform fees may vary by company partnership agreements.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function CompanyPayoutApproval({ payouts }: { payouts: CreatorPayment[] }) {
  const { toast } = useToast();
  const [disputePayoutId, setDisputePayoutId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string }>({
    open: false,
    title: "",
    description: "",
  });

  const pendingPayouts = useMemo(
    () => payouts.filter((payout) => payout.status === "pending" || payout.status === "processing"),
    [payouts]
  );

  const totalPendingAmount = pendingPayouts.reduce(
    (sum, payout) => sum + parseFloat(payout.grossAmount),
    0
  );

  const filteredPendingPayouts = useMemo(() => {
    return pendingPayouts.filter((payout) => {
      const matchesSearch = searchTerm
        ? [
            payout.description,
            payout.id,
            payout.status,
          ]
            .filter(Boolean)
            .some(
              (value) =>
                typeof value === "string" &&
                value.toLowerCase().includes(searchTerm.toLowerCase()),
            )
        : true;
      const matchesStatus = statusFilter === "all" || payout.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [pendingPayouts, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm.trim().length > 0 || statusFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  const approvePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await apiRequest("POST", `/api/company/payments/${paymentId}/approve`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/company"] });
      toast({
        title: "Success",
        description: "Payment approved successfully",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to approve payment",
      });
    },
  });

  const disputePaymentMutation = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/company/payments/${paymentId}/dispute`, { reason });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/company"] });
      setDisputePayoutId(null);
      setDisputeReason("");
      toast({
        title: "Success",
        description: "Payment disputed successfully",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to dispute payment",
      });
    },
  });

  return (
    <div className="space-y-6">
      {pendingPayouts.length > 0 && (
        <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50 p-6">
          <div className="mb-3 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            <h3 className="text-lg font-bold text-yellow-900">Pending Approvals</h3>
          </div>
          <p className="text-yellow-800">
            You have {pendingPayouts.length} payout{pendingPayouts.length !== 1 ? "s" : ""} pending approval
            totaling ${totalPendingAmount.toFixed(2)}
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-bold text-gray-900">Payout Requests</h3>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                <X className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-500">Search</label>
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by description or ID"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Showing {filteredPendingPayouts.length} of {pendingPayouts.length} pending payout request
            {pendingPayouts.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredPendingPayouts.length === 0 ? (
            <div className="py-12 text-center">
              {pendingPayouts.length === 0 ? (
                <p className="text-gray-500">No pending approvals</p>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Search className="h-8 w-8" />
                  <p>No payout requests match your filters</p>
                </div>
              )}
            </div>
          ) : (
            filteredPendingPayouts.map((payout) => (
              <div key={payout.id} className="p-4 sm:p-6 transition hover:bg-gray-50">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                      <h4 className="font-bold text-gray-900 break-words">
                        {payout.description || `Payment ${payout.id.slice(0, 8)}`}
                      </h4>
                      <StatusBadge status={payout.status} isDisputed={isDisputedPayment(payout as CreatorPayment)} />
                    </div>
                    <p className="text-sm text-gray-600">
                      Created: {new Date(payout.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0">
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">
                      ${parseFloat(payout.grossAmount).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">Creator payment</div>
                  </div>
                </div>

                <div className="mb-4 rounded-lg bg-gray-50 p-3 sm:p-4">
                  <div className="grid grid-cols-1 gap-3 sm:gap-4 text-sm sm:grid-cols-3">
                    <div>
                      <div className="mb-1 text-gray-600">Creator Payment</div>
                      <div className="font-medium text-gray-900">
                        ${parseFloat(payout.grossAmount).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-gray-600">
                        Platform Fee ({parseFloat(payout.grossAmount) > 0 ? ((parseFloat(payout.platformFeeAmount) / parseFloat(payout.grossAmount)) * 100).toFixed(0) : '4'}%)
                      </div>
                      <div className="font-medium text-gray-900">
                        ${parseFloat(payout.platformFeeAmount).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-gray-600">
                        Processing ({parseFloat(payout.grossAmount) > 0 ? ((parseFloat(payout.stripeFeeAmount) / parseFloat(payout.grossAmount)) * 100).toFixed(0) : '3'}%)
                      </div>
                      <div className="font-medium text-gray-900">
                        ${parseFloat(payout.stripeFeeAmount).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <Button
                    className="flex-1 gap-2 bg-green-600 text-white hover:bg-green-700"
                    onClick={() => approvePaymentMutation.mutate(payout.id)}
                    disabled={approvePaymentMutation.isPending || payout.status === "processing"}
                  >
                    <CheckCircle className="h-4 w-4" />
                    {payout.status === "processing" 
                      ? "Processing..." 
                      : approvePaymentMutation.isPending 
                      ? "Approving..." 
                      : "Approve Payment"}
                  </Button>
                  <Button
                    className="flex-1 gap-2 bg-red-600 text-white hover:bg-red-700"
                    onClick={() => {
                      const reason = prompt("Enter reason for dispute:");
                      if (reason) {
                        disputePaymentMutation.mutate({ paymentId: payout.id, reason });
                      }
                    }}
                    disabled={disputePaymentMutation.isPending || payout.status === "processing"}
                  >
                    <XCircle className="h-4 w-4" />
                    {disputePaymentMutation.isPending ? "Disputing..." : "Dispute"}
                  </Button>
                </div>

              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CompanyOverview({ payouts }: { payouts: CreatorPayment[] }) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string }>({
    open: false,
    title: "",
    description: "",
  });
  const totalPaid = payouts
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + parseFloat(p.grossAmount), 0);

  const pendingAmount = payouts
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((sum, p) => sum + parseFloat(p.grossAmount), 0);

  const filteredPayouts = useMemo(() => {
    return payouts.filter((payout) => {
      const matchesSearch = searchTerm
        ? [
            payout.description,
            payout.id,
            payout.status,
          ]
            .filter(Boolean)
            .some(
              (value) =>
                typeof value === "string" &&
                value.toLowerCase().includes(searchTerm.toLowerCase()),
            )
        : true;
      const matchesStatus = statusFilter === "all" || payout.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [payouts, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm.trim().length > 0 || statusFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  const exportPayments = () => {
    const csv = [
      ['ID', 'Description', 'Creator Earnings', 'Fees', 'Status', 'Date'],
      ...payouts.map(p => [
        p.id.slice(0, 8),
        p.description || 'Payment',
        p.grossAmount,
        (parseFloat(p.platformFeeAmount) + parseFloat(p.stripeFeeAmount)).toFixed(2),
        p.status,
        p.completedAt || p.createdAt
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `company-payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Payment history exported successfully",
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Paid Out</span>
            <Send className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">${totalPaid.toFixed(2)}</div>
          <div className="mt-1 text-xs text-gray-500">All-time</div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 p-6 text-white">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-yellow-100">Pending</span>
            <Clock className="h-5 w-5 text-yellow-100" />
          </div>
          <div className="text-3xl font-bold">${pendingAmount.toFixed(2)}</div>
          <div className="mt-1 text-xs text-yellow-100">Requires action</div>
        </div>

        <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Payments</span>
            <Users className="h-5 w-5 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{payouts.length}</div>
          <div className="mt-1 text-xs text-gray-500">All transactions</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6 space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">Payment History</h3>
              <Badge variant="secondary" className="hidden lg:inline-flex">
                {filteredPayouts.length} of {payouts.length}
              </Badge>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex-1 min-w-[200px]">
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search transactions"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                  <X className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={exportPayments}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Showing {filteredPayouts.length} of {payouts.length} records
          </p>
        </div>
        <div className="overflow-x-auto">
          {filteredPayouts.length === 0 ? (
            <div className="py-12 text-center">
              {payouts.length === 0 ? (
                <p className="text-gray-500">No payment history yet</p>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Search className="h-8 w-8" />
                  <p>No payments match your filters</p>
                </div>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Creator Earnings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Fees
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredPayouts.map((payout) => (
                  <tr key={payout.id} className="transition hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {payout.id.slice(0, 8)}...
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {payout.description || "Payment"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      ${parseFloat(payout.grossAmount).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      ${(parseFloat(payout.platformFeeAmount) + parseFloat(payout.stripeFeeAmount)).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={payout.status} isDisputed={isDisputedPayment(payout as CreatorPayment)} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {payout.completedAt
                        ? new Date(payout.completedAt).toLocaleDateString()
                        : new Date(payout.createdAt).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link href={`/payments/${payout.id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" />
                          View Details
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        variant="error"
      />
    </div>
  );
}

function AdminPaymentDashboard({
  payments,
}: {
  payments: CreatorPayment[];
}) {
  const { toast } = useToast();
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string }>({
    open: false,
    title: "",
    description: "",
  });
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [paymentToProcess, setPaymentToProcess] = useState<CreatorPayment | null>(null);
  const [insufficientFundsDialogOpen, setInsufficientFundsDialogOpen] = useState(false);
  const [failedPayment, setFailedPayment] = useState<CreatorPayment | null>(null);
  const [minimumPaymentDialogOpen, setMinimumPaymentDialogOpen] = useState(false);
  const [minimumPaymentError, setMinimumPaymentError] = useState<string>("");
  const [paymentFailedDialogOpen, setPaymentFailedDialogOpen] = useState(false);
  const [paymentFailedError, setPaymentFailedError] = useState<string>("");

  const allPayments = payments;

  const filteredPayments = useMemo(() => {
    return allPayments.filter((payment) => {
      const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
      const matchesSearch = searchTerm
        ? [payment.description, payment.id, payment.status]
            .filter(Boolean)
            .some(
              (value) =>
                typeof value === "string" &&
                value.toLowerCase().includes(searchTerm.toLowerCase()),
            )
        : true;
      return matchesStatus && matchesSearch;
    });
  }, [allPayments, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm.trim().length > 0 || statusFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  const totalPlatformRevenue = allPayments.reduce((sum, payment) => {
    return sum + parseFloat(payment.platformFeeAmount) + parseFloat(payment.stripeFeeAmount);
  }, 0);

  const totalGMV = allPayments.reduce((sum, payment) => {
    return sum + parseFloat(payment.grossAmount);
  }, 0);

  const pendingCount = allPayments.filter(
    (p) => p.status === "pending" || p.status === "processing"
  ).length;

  const exportPayments = () => {
    const csv = [
      ['Transaction ID', 'Description', 'Gross', 'Platform Fee', 'Net', 'Status', 'Date'],
      ...filteredPayments.map(p => [
        p.id.slice(0, 8),
        p.description || 'Payment',
        p.grossAmount,
        (parseFloat(p.platformFeeAmount) + parseFloat(p.stripeFeeAmount)).toFixed(2),
        p.netAmount,
        p.status,
        p.completedAt || p.createdAt
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `platform-payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Payment data exported successfully",
    });
  };

  const bulkProcessMutation = useMutation({
    mutationFn: async () => {
      const processingPayments = filteredPayments.filter(p => p.status === "processing");

      if (processingPayments.length === 0) {
        throw new Error("No processing payments to complete");
      }

      const results = await Promise.all(
        processingPayments.map(async payment => {
          const res = await apiRequest("PATCH", `/api/payments/${payment.id}/status`, { status: "completed" });
          return await res.json();
        })
      );

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/all"] });
      toast({
        title: "Success",
        description: `${results.length} payment(s) marked as completed`,
      });
    },
    onError: (error: Error) => {
      const errorMsg = error.message || "Failed to process payments";

      // Check if it's a minimum payment error
      const isMinimumPaymentError = errorMsg.toLowerCase().includes('minimum') ||
                                     errorMsg.toLowerCase().includes('below the minimum required amount');

      if (isMinimumPaymentError) {
        setMinimumPaymentError(errorMsg);
        setMinimumPaymentDialogOpen(true);
      } else {
        setErrorDialog({
          open: true,
          title: "Error",
          description: errorMsg,
        });
      }
    },
  });

  // Handler to open confirmation dialog
  const handleApprovePayment = (payment: CreatorPayment) => {
    setPaymentToProcess(payment);
    setConfirmDialogOpen(true);
  };

  // Handler to confirm and process payment
  const confirmProcessPayment = () => {
    if (paymentToProcess) {
      processPaymentMutation.mutate(paymentToProcess.id);
    }
    setConfirmDialogOpen(false);
    setPaymentToProcess(null);
  };

  // Mutation to approve/process individual payment
  const processPaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await apiRequest("PATCH", `/api/payments/${paymentId}/status`, { status: "completed" });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/all"] });
      toast({
        title: "Success",
        description: "Payment processed and sent to creator",
      });
    },
    onError: (error: Error, paymentId: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/all"] });

      // Extract clean error message
      let errorMsg = error.message || "Failed to process payment";

      // Check if it's an insufficient funds error
      const isInsufficientFunds = errorMsg.toLowerCase().includes('insufficient funds');

      // Check if it's a minimum payment error
      const isMinimumPaymentError = errorMsg.toLowerCase().includes('minimum') ||
                                     errorMsg.toLowerCase().includes('below the minimum required amount');

      if (isInsufficientFunds) {
        // Find the payment that failed
        const payment = allPayments.find(p => p.id === paymentId);
        if (payment) {
          setFailedPayment(payment);
        }
        setInsufficientFundsDialogOpen(true);
      } else if (isMinimumPaymentError) {
        // Show minimum payment dialog instead of toast
        const payment = allPayments.find(p => p.id === paymentId);
        if (payment) {
          setFailedPayment(payment);
        }
        setMinimumPaymentError(errorMsg);
        setMinimumPaymentDialogOpen(true);
      } else {
        // Show payment failed dialog for other types of errors
        const payment = allPayments.find(p => p.id === paymentId);
        if (payment) {
          setFailedPayment(payment);
        }
        setPaymentFailedError(errorMsg);
        setPaymentFailedDialogOpen(true);
      }
    },
  });

  // Mutation to mark as processing
  const markProcessingMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await apiRequest("PATCH", `/api/payments/${paymentId}/status`, { status: "processing" });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/all"] });
      toast({
        title: "Success",
        description: "Payment marked as processing",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to update payment status",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-white">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-purple-100">Platform Revenue</span>
            <TrendingUp className="h-5 w-5 text-purple-100" />
          </div>
          <div className="text-3xl font-bold">${totalPlatformRevenue.toFixed(2)}</div>
          <div className="mt-1 text-xs text-purple-100">7% of GMV</div>
        </div>

        <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-600">Total GMV</span>
            <DollarSign className="h-5 w-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">${totalGMV.toFixed(2)}</div>
          <div className="mt-1 text-xs text-gray-500">Gross merchandise value</div>
        </div>

        <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Transactions</span>
            <Send className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{allPayments.length}</div>
          <div className="mt-1 text-xs text-gray-500">All-time</div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 p-6 text-white">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-yellow-100">Pending</span>
            <Clock className="h-5 w-5 text-yellow-100" />
          </div>
          <div className="text-3xl font-bold">{pendingCount}</div>
          <div className="mt-1 text-xs text-yellow-100">Awaiting processing</div>
        </div>
      </div>

      {filteredPayments.filter(p => p.status === "processing").length > 0 && (
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-blue-900">Process Payments</h3>
              <p className="mt-1 text-sm text-blue-700">
                {filteredPayments.filter(p => p.status === "processing").length} payment(s) ready to be marked as completed
              </p>
            </div>
            <Button
              onClick={() => bulkProcessMutation.mutate()}
              disabled={bulkProcessMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {bulkProcessMutation.isPending ? "Processing..." : "Complete All Processing"}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">All Transactions</h3>
            <p className="mt-1 text-sm text-gray-600">Complete platform payment history</p>
            <p className="mt-1 text-xs text-gray-500">
              Showing {filteredPayments.length} of {allPayments.length} transactions
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search payments"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                <X className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={exportPayments}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {filteredPayments.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              {allPayments.length === 0 ? (
                <p>No payments found</p>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Search className="h-8 w-8" />
                  <p>No payments match your filters</p>
                </div>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Transaction ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Gross
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Platform Fee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Net
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="transition hover:bg-gray-50 cursor-pointer">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      <Link href={`/payments/${payment.id}`} className="block hover:text-primary">
                        {payment.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      <Link href={`/payments/${payment.id}`} className="block">
                        {payment.description || "Payment"}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      <Link href={`/payments/${payment.id}`} className="block">
                        ${parseFloat(payment.grossAmount).toFixed(2)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-purple-600">
                      <Link href={`/payments/${payment.id}`} className="block">
                        ${(parseFloat(payment.platformFeeAmount) + parseFloat(payment.stripeFeeAmount)).toFixed(2)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-green-600">
                      <Link href={`/payments/${payment.id}`} className="block">
                        ${parseFloat(payment.netAmount).toFixed(2)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link href={`/payments/${payment.id}`} className="block">
                        <StatusBadge status={payment.status} isDisputed={isDisputedPayment(payment as CreatorPayment)} />
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      <Link href={`/payments/${payment.id}`} className="block">
                        {payment.completedAt
                          ? new Date(payment.completedAt).toLocaleDateString()
                          : new Date(payment.createdAt).toLocaleDateString()}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                      {payment.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={(e) => { e.preventDefault(); handleApprovePayment(payment); }}
                          disabled={processPaymentMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Approve & Pay
                        </Button>
                      )}
                      {payment.status === 'processing' && (
                        <Button
                          size="sm"
                          onClick={(e) => { e.preventDefault(); handleApprovePayment(payment); }}
                          disabled={processPaymentMutation.isPending}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Send className="mr-1 h-4 w-4" />
                          Send Payment
                        </Button>
                      )}
                      {payment.status === 'completed' && (
                        <span className="text-xs text-gray-500 italic">Completed</span>
                      )}
                      {payment.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.preventDefault(); markProcessingMutation.mutate(payment.id); }}
                          disabled={markProcessingMutation.isPending}
                        >
                          Retry
                        </Button>
                      )}
                      {payment.status === 'refunded' && (
                        <span className="text-xs text-gray-500 italic">Refunded</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Payment Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Confirm Payment Processing
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p>You are about to process a payment of <strong>${paymentToProcess?.netAmount}</strong> to the creator.</p>

              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-yellow-900">
                    <p className="font-semibold mb-1">Important:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Ensure your PayPal business account has sufficient funds</li>
                      <li>This will send real money to the creator's account</li>
                      <li>If payment fails, you can retry from the dashboard</li>
                    </ul>
                  </div>
                </div>
              </div>

              <p className="text-sm">Payment details:</p>
              <div className="text-sm bg-gray-50 rounded p-2 space-y-1">
                <div><strong>Amount:</strong> ${paymentToProcess?.netAmount}</div>
                <div><strong>Description:</strong> {paymentToProcess?.description || 'Payment'}</div>
                <div><strong>Status:</strong> {paymentToProcess?.status}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmProcessPayment}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirm & Process Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Insufficient Funds Dialog */}
      <AlertDialog open={insufficientFundsDialogOpen} onOpenChange={setInsufficientFundsDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-blue-900">
              <DollarSign className="h-6 w-6 text-blue-600" />
              Payment Request On Hold
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-3">
              <div className="rounded-lg bg-blue-50 border-2 border-blue-200 p-4">
                <p className="text-gray-800 leading-relaxed">
                  The company's PayPal account has insufficient funds to process this payment request. The payment cannot be completed at this time.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Payment Request Details:</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-semibold text-gray-900">${failedPayment?.netAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Description:</span>
                    <span className="font-medium text-gray-900">{failedPayment?.description || 'Payment'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment ID:</span>
                    <span className="font-mono text-xs text-gray-700">{failedPayment?.id.slice(0, 12)}...</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                <p className="text-sm font-semibold text-yellow-900 mb-2">What Happened:</p>
                <ul className="space-y-1.5 text-sm text-yellow-800">
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>The payment could not be processed due to insufficient funds in the company's PayPal account</span>
                  </li>
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>The payment status has been updated to "failed"</span>
                  </li>
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>Click "Send Notification" below to inform the company about this issue</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                <p className="text-sm font-semibold text-green-900 mb-2">Next Steps:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-green-800">
                  <li>Wait for the company to add funds to their PayPal account</li>
                  <li>Once notified that funds are available, retry the payment</li>
                  <li>Use the "Retry" button on the failed payment in the dashboard</li>
                </ol>
              </div>

              <p className="text-xs text-gray-500 italic">
                This payment request will remain in "failed" status until the company resolves the funding issue and you retry the transaction.
              </p>

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mt-4">
                <p className="text-sm font-semibold text-blue-900 mb-1">\u2705 Notification Sent Automatically</p>
                <p className="text-xs text-blue-800">
                  The company has been automatically notified via email and in-app notification about this insufficient funds issue.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Close
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Minimum Payment Amount Dialog */}
      <AlertDialog open={minimumPaymentDialogOpen} onOpenChange={setMinimumPaymentDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-900">
              <Info className="h-6 w-6 text-orange-600" />
              Minimum Payment Amount Required
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-3">
              <div className="rounded-lg bg-orange-50 border-2 border-orange-200 p-4">
                <p className="text-gray-800 leading-relaxed">
                  The payment amount is below the minimum required for E-Transfer transactions. Stripe requires a minimum transfer of at least <strong>$1.00 CAD</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Payment Details:</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-semibold text-gray-900">${failedPayment?.netAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Description:</span>
                    <span className="font-medium text-gray-900">{failedPayment?.description || 'Payment'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment ID:</span>
                    <span className="font-mono text-xs text-gray-700">{failedPayment?.id.slice(0, 12)}...</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-sm font-semibold text-blue-900 mb-2">Important Information:</p>
                <ul className="space-y-1.5 text-sm text-blue-800">
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>E-Transfer payments via Stripe require a minimum of <strong>$1.00 CAD</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>This payment has been marked as "failed" due to not meeting the minimum requirement</span>
                  </li>
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>Please ensure future payments meet or exceed the minimum amount</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                <p className="text-sm font-semibold text-green-900 mb-2">Next Steps:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-green-800">
                  <li>Review payment amounts before processing</li>
                  <li>Consider combining small payments to meet the minimum threshold</li>
                  <li>Contact the creator if payment amounts need to be adjusted</li>
                </ol>
              </div>

              {minimumPaymentError && (
                <div className="rounded-lg bg-gray-100 border border-gray-300 p-3">
                  <p className="text-xs font-mono text-gray-700">
                    {minimumPaymentError}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Close
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Failed Reminder Dialog */}
      <AlertDialog open={paymentFailedDialogOpen} onOpenChange={setPaymentFailedDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-gray-900">
              <Info className="h-6 w-6 text-gray-600" />
              Payment Processing Reminder
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-3">
              <div className="rounded-lg bg-gray-50 border-2 border-gray-200 p-4">
                <p className="text-gray-800 leading-relaxed">
                  The payment could not be processed at this time. Please review the details below and take appropriate action.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Payment Details:</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-semibold text-gray-900">${failedPayment?.netAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Description:</span>
                    <span className="font-medium text-gray-900">{failedPayment?.description || 'Payment'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment ID:</span>
                    <span className="font-mono text-xs text-gray-700">{failedPayment?.id.slice(0, 12)}...</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-sm font-semibold text-blue-900 mb-2">What Happened:</p>
                <ul className="space-y-1.5 text-sm text-blue-800">
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>The payment processing encountered an issue</span>
                  </li>
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>The payment status has been updated to "failed"</span>
                  </li>
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>Please review the error details below</span>
                  </li>
                </ul>
              </div>

              {paymentFailedError && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                  <p className="text-sm font-semibold text-yellow-900 mb-2">Error Details:</p>
                  <p className="text-sm text-yellow-800">
                    {paymentFailedError}
                  </p>
                </div>
              )}

              <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                <p className="text-sm font-semibold text-green-900 mb-2">Next Steps:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-green-800">
                  <li>Review the error details and payment information</li>
                  <li>Verify the payment settings are configured correctly</li>
                  <li>Contact the creator if additional information is needed</li>
                  <li>Use the "Retry" button to process the payment again once the issue is resolved</li>
                </ol>
              </div>

              <p className="text-xs text-gray-500 italic">
                This payment will remain in "failed" status until you successfully retry the transaction or take corrective action.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Close
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        variant="error"
      />
    </div>
  );
}

function AdminPaymentSettings() {
  const { toast } = useToast();
  const [settlementSchedule, setSettlementSchedule] = useState("weekly");
  const [reservePercentage, setReservePercentage] = useState("10");
  const [minimumBalance, setMinimumBalance] = useState("5000");
  const [autoDisburse, setAutoDisburse] = useState(true);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string }>({
    open: false,
    title: "",
    description: "",
  });
  const [notificationEmail, setNotificationEmail] = useState("finance@affiliatexchange.com");
  const [escalationEmail, setEscalationEmail] = useState("compliance@affiliatexchange.com");
  const [includeReports, setIncludeReports] = useState(true);
  const [smsEscalation, setSmsEscalation] = useState(true);

  // Fetch platform settings
  const { data: platformSettings } = useQuery<Array<{key: string; value: string}>>({
    queryKey: ["/api/admin/settings"],
  });

  // Load settings from backend
  useEffect(() => {
    if (platformSettings) {
      const settingsMap = new Map(platformSettings.map(s => [s.key, s.value]));
      if (settingsMap.has("payment.settlement_schedule")) setSettlementSchedule(settingsMap.get("payment.settlement_schedule")!);
      if (settingsMap.has("payment.reserve_percentage")) setReservePercentage(settingsMap.get("payment.reserve_percentage")!);
      if (settingsMap.has("payment.minimum_balance")) setMinimumBalance(settingsMap.get("payment.minimum_balance")!);
      if (settingsMap.has("payment.auto_disburse")) setAutoDisburse(settingsMap.get("payment.auto_disburse") === "true");
      if (settingsMap.has("payment.notification_email")) setNotificationEmail(settingsMap.get("payment.notification_email")!);
      if (settingsMap.has("payment.escalation_email")) setEscalationEmail(settingsMap.get("payment.escalation_email")!);
      if (settingsMap.has("payment.include_reports")) setIncludeReports(settingsMap.get("payment.include_reports") === "true");
      if (settingsMap.has("payment.sms_escalation")) setSmsEscalation(settingsMap.get("payment.sms_escalation") === "true");
    }
  }, [platformSettings]);

  // Mutation to update platform settings
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiRequest("PUT", `/api/admin/settings/${key}`, { value });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to update setting",
      });
    },
  });

  const saveDisbursementSettings = async () => {
    try {
      await Promise.all([
        updateSettingMutation.mutateAsync({ key: "payment.settlement_schedule", value: settlementSchedule }),
        updateSettingMutation.mutateAsync({ key: "payment.reserve_percentage", value: reservePercentage }),
        updateSettingMutation.mutateAsync({ key: "payment.minimum_balance", value: minimumBalance }),
        updateSettingMutation.mutateAsync({ key: "payment.auto_disburse", value: autoDisburse.toString() }),
      ]);
      toast({
        title: "Success",
        description: "Disbursement settings updated successfully",
      });
    } catch (error) {
      // Error already handled by mutation
    }
  };

  const saveNotificationSettings = async () => {
    try {
      await Promise.all([
        updateSettingMutation.mutateAsync({ key: "payment.notification_email", value: notificationEmail }),
        updateSettingMutation.mutateAsync({ key: "payment.escalation_email", value: escalationEmail }),
        updateSettingMutation.mutateAsync({ key: "payment.include_reports", value: includeReports.toString() }),
        updateSettingMutation.mutateAsync({ key: "payment.sms_escalation", value: smsEscalation.toString() }),
      ]);
      toast({
        title: "Success",
        description: "Notification preferences saved successfully",
      });
    } catch (error) {
      // Error already handled by mutation
    }
  };

  // Fetch funding accounts
  const { data: fundingAccounts = [] } = useQuery<Array<{
    id: string;
    name: string;
    type: "bank" | "wallet" | "card";
    last4: string;
    status: "active" | "pending" | "disabled";
    isPrimary: boolean;
  }>>({
    queryKey: ["/api/admin/funding-accounts"],
  });

  // Add funding account state
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<"bank" | "wallet" | "card">("bank");
  const [accountLast4, setAccountLast4] = useState("");

  const addAccountMutation = useMutation({
    mutationFn: async (account: { name: string; type: string; last4: string; status: string }) => {
      const res = await apiRequest("POST", "/api/admin/funding-accounts", account);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/funding-accounts"] });
      setShowAddAccount(false);
      setAccountName("");
      setAccountLast4("");
      toast({
        title: "Success",
        description: "Funding account added successfully",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to add funding account",
      });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/funding-accounts/${id}`, updates);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/funding-accounts"] });
      toast({
        title: "Success",
        description: "Account updated successfully",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to update account",
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/funding-accounts/${id}`, undefined);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/funding-accounts"] });
      toast({
        title: "Success",
        description: "Account deleted successfully",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to delete account",
      });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/funding-accounts/${id}/set-primary`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/funding-accounts"] });
      toast({
        title: "Success",
        description: "Primary account updated",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to set primary account",
      });
    },
  });

  const typeLabels: Record<"bank" | "wallet" | "card", string> = {
    bank: "Bank Account",
    wallet: "Custody Wallet",
    card: "Corporate Card",
  };

  const statusStyles: Record<"active" | "pending" | "disabled", string> = {
    active: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    disabled: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900">Disbursement Controls</h3>
          <p className="mt-1 text-sm text-gray-600">
            Configure how platform-wide payouts are released to creators and external partners.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="admin-settlement-schedule">Settlement Schedule</Label>
            <Select value={settlementSchedule} onValueChange={setSettlementSchedule}>
              <SelectTrigger id="admin-settlement-schedule">
                <SelectValue placeholder="Select schedule" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Bi-weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Determines how frequently approved creator payments are bundled for release.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-reserve-percentage">Platform Reserve %</Label>
            <Input
              id="admin-reserve-percentage"
              type="number"
              min={0}
              max={50}
              value={reservePercentage}
              onChange={(event) => setReservePercentage(event.target.value)}
            />
            <p className="text-xs text-gray-500">
              Holdback applied to every payout to maintain compliance and risk buffers.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-minimum-balance">Minimum Operating Balance ($)</Label>
            <Input
              id="admin-minimum-balance"
              type="number"
              min={0}
              step="100"
              value={minimumBalance}
              onChange={(event) => setMinimumBalance(event.target.value)}
            />
            <p className="text-xs text-gray-500">
              Payouts pause automatically if platform funds fall below this threshold.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Automatic Disbursement</Label>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
              <div>
                <p className="text-sm font-medium text-gray-900">Enable auto-processing</p>
                <p className="text-xs text-gray-500">
                  When disabled, finance must manually trigger every payout batch.
                </p>
              </div>
              <Switch checked={autoDisburse} onCheckedChange={setAutoDisburse} aria-label="Toggle automatic disbursement" />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={saveDisbursementSettings}
            disabled={updateSettingMutation.isPending}
          >
            {updateSettingMutation.isPending ? "Saving..." : "Update Disbursement Policy"}
          </Button>
          <span className="text-xs text-gray-500">
            Last reviewed 2 days ago by Finance Ops.
          </span>
        </div>
      </div>

      <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Platform Funding Accounts</h3>
            <p className="mt-1 text-sm text-gray-600">
              Manage the accounts used to fund creator payouts and collect platform fees.
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowAddAccount(true)}>Add Funding Source</Button>
        </div>

        {showAddAccount && (
          <div className="mb-6 rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
            <h4 className="mb-4 font-bold text-blue-900">Add New Funding Account</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-name">Account Name</Label>
                <Input
                  id="account-name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Primary Operating Account"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-type">Account Type</Label>
                <Select value={accountType} onValueChange={(v) => setAccountType(v as any)}>
                  <SelectTrigger id="account-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Account</SelectItem>
                    <SelectItem value="wallet">Custody Wallet</SelectItem>
                    <SelectItem value="card">Corporate Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-last4">Last 4 Digits</Label>
                <Input
                  id="account-last4"
                  value={accountLast4}
                  onChange={(e) => setAccountLast4(e.target.value)}
                  placeholder="1234"
                  maxLength={4}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (accountName && accountLast4) {
                      addAccountMutation.mutate({
                        name: accountName,
                        type: accountType,
                        last4: accountLast4,
                        status: "pending",
                      });
                    }
                  }}
                  disabled={!accountName || !accountLast4 || addAccountMutation.isPending}
                >
                  {addAccountMutation.isPending ? "Adding..." : "Add Account"}
                </Button>
                <Button variant="outline" onClick={() => setShowAddAccount(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {fundingAccounts.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              No funding accounts yet. Add one to get started.
            </div>
          ) : (
            fundingAccounts.map((account) => (
              <div key={account.id} className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{account.name}</div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    {typeLabels[account.type]} · Ending in {account.last4}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {account.isPrimary && <Badge>Primary</Badge>}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[account.status]}`}>
                    {account.status === "active"
                      ? "Active"
                      : account.status === "pending"
                      ? "Pending Verification"
                      : "Disabled"}
                  </span>
                  {!account.isPrimary && account.status === "active" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPrimaryMutation.mutate(account.id)}
                      disabled={setPrimaryMutation.isPending}
                    >
                      Set Primary
                    </Button>
                  )}
                  {account.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateAccountMutation.mutate({ id: account.id, updates: { status: "active" } })}
                      disabled={updateAccountMutation.isPending}
                    >
                      Activate
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this account?")) {
                        deleteAccountMutation.mutate(account.id);
                      }
                    }}
                    disabled={deleteAccountMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900">Notifications & Escalation</h3>
          <p className="mt-1 text-sm text-gray-600">
            Control who is notified when payouts process, fail, or require manual review.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="admin-notification-email">Primary Finance Contact</Label>
            <Input
              id="admin-notification-email"
              type="email"
              value={notificationEmail}
              onChange={(event) => setNotificationEmail(event.target.value)}
            />
            <p className="text-xs text-gray-500">Daily settlement summaries are delivered to this inbox.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-escalation-email">Escalation Contact</Label>
            <Input
              id="admin-escalation-email"
              type="email"
              value={escalationEmail}
              onChange={(event) => setEscalationEmail(event.target.value)}
            />
            <p className="text-xs text-gray-500">Disputes and compliance holds are routed here for fast action.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Attach financial reports</Label>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
              <div>
                <p className="text-sm font-medium text-gray-900">Include CSV exports in alerts</p>
                <p className="text-xs text-gray-500">Automate weekly payout exports for accounting reconciliation.</p>
              </div>
              <Switch
                checked={includeReports}
                onCheckedChange={setIncludeReports}
                aria-label="Toggle report attachments"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">SMS escalation</Label>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
              <div>
                <p className="text-sm font-medium text-gray-900">Trigger SMS on payout failures</p>
                <p className="text-xs text-gray-500">Sends texts to the escalation contact when urgent action is required.</p>
              </div>
              <Switch
                checked={smsEscalation}
                onCheckedChange={setSmsEscalation}
                aria-label="Toggle SMS escalation"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={saveNotificationSettings}
            disabled={updateSettingMutation.isPending}
          >
            {updateSettingMutation.isPending ? "Saving..." : "Save Notification Preferences"}
          </Button>
        </div>
      </div>

      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        variant="error"
      />
    </div>
  );
}

export default function PaymentSettings() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "settings" | "approvals" | "dashboard">("overview");

  // Quick Guide Tour - for both creator and company users
  const isCreator = user?.role === 'creator';
  const isCompany = user?.role === 'company';
  useCreatorPageTour(CREATOR_TOUR_IDS.PAYMENT_SETTINGS, creatorPaymentTourSteps, isCreator);
  useCompanyPageTour(COMPANY_TOUR_IDS.PAYMENT_SETTINGS, companyPaymentTourSteps, isCompany);

  const [payoutMethod, setPayoutMethod] = useState("etransfer");
  const [payoutEmail, setPayoutEmail] = useState("");
  const [bankRoutingNumber, setBankRoutingNumber] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [cryptoWalletAddress, setCryptoWalletAddress] = useState("");
  const [cryptoNetwork, setCryptoNetwork] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentMethodToDelete, setPaymentMethodToDelete] = useState<PaymentMethod | null>(null);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string }>({
    open: false,
    title: "",
    description: "",
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setErrorDialog({
        open: true,
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (user?.role === "company" || user?.role === "creator") {
      setActiveTab("overview");
      return;
    }
    if (user?.role === "admin") {
      setActiveTab("dashboard");
    }
  }, [user?.role]);

  // Handle Stripe Connect onboarding return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const onboardingStatus = params.get('stripe_onboarding');

    if (onboardingStatus === 'success') {
      toast({
        title: "Success",
        description: "Stripe Connect onboarding completed! Your e-transfer payment method is now active.",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (onboardingStatus === 'refresh') {
      setErrorDialog({
        open: true,
        title: "Setup Incomplete",
        description: "Stripe Connect onboarding was not completed. Please try again.",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch payment methods
  const { data: paymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/payment-settings"],
    enabled: isAuthenticated,
  });

  // Fetch payments based on user role
  const { data: creatorPayments = [] } = useQuery<CreatorPayment[]>({
    queryKey: ["/api/payments/creator"],
    enabled: isAuthenticated && user?.role === "creator",
  });

  const { data: companyPayments = [] } = useQuery<CreatorPayment[]>({
    queryKey: ["/api/payments/company"],
    enabled: isAuthenticated && user?.role === "company",
  });

  const { data: allPayments = [] } = useQuery<CreatorPayment[]>({
    queryKey: ["/api/payments/all"],
    enabled: isAuthenticated && user?.role === "admin",
  });

  const addPaymentMethodMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = { payoutMethod };

      // For e-transfer, we need to set up Stripe Connect first
      if (payoutMethod === "etransfer") {
        payload.payoutEmail = payoutEmail;

        // Step 1: Create Stripe Connect account
        const accountRes = await apiRequest("POST", "/api/stripe-connect/create-account");
        const accountData = await accountRes.json();

        if (!accountData.success || !accountData.accountId) {
          throw new Error(accountData.error || "Failed to create Stripe Connect account");
        }

        // Step 2: Save the stripeAccountId with payment settings
        payload.stripeAccountId = accountData.accountId;

        // Save payment settings first
        const res = await apiRequest("POST", "/api/payment-settings", payload);
        const result = await res.json();

        // Step 3: Redirect to Stripe onboarding
        const onboardingRes = await apiRequest("POST", "/api/stripe-connect/onboarding-link", {
          accountId: accountData.accountId,
          returnUrl: `${window.location.origin}/settings/payment?stripe_onboarding=success`,
          refreshUrl: `${window.location.origin}/settings/payment?stripe_onboarding=refresh`,
        });
        const onboardingData = await onboardingRes.json();

        if (!onboardingData.success || !onboardingData.url) {
          throw new Error(onboardingData.error || "Failed to create onboarding link");
        }

        // Redirect user to Stripe onboarding
        window.location.href = onboardingData.url;
        return result;
      } else if (payoutMethod === "wire") {
        payload.bankRoutingNumber = bankRoutingNumber;
        payload.bankAccountNumber = bankAccountNumber;
      } else if (payoutMethod === "paypal") {
        payload.paypalEmail = paypalEmail;
      } else if (payoutMethod === "crypto") {
        payload.cryptoWalletAddress = cryptoWalletAddress;
        payload.cryptoNetwork = cryptoNetwork;
      }

      const res = await apiRequest("POST", "/api/payment-settings", payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-settings"] });
      toast({
        title: "Success",
        description: "Payment method added successfully",
      });
      setPayoutEmail("");
      setBankRoutingNumber("");
      setBankAccountNumber("");
      setPaypalEmail("");
      setCryptoWalletAddress("");
      setCryptoNetwork("");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        setErrorDialog({
          open: true,
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to add payment method",
      });
    },
  });

  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: number) => {
      const res = await apiRequest("DELETE", `/api/payment-settings/${paymentMethodId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-settings"] });
      toast({
        title: "Success",
        description: "Payment method deleted successfully",
      });
      setDeleteDialogOpen(false);
      setPaymentMethodToDelete(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        setErrorDialog({
          open: true,
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to delete payment method",
      });
    },
  });

  const handleDeleteClick = (method: PaymentMethod) => {
    setPaymentMethodToDelete(method);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (paymentMethodToDelete) {
      deletePaymentMethodMutation.mutate(paymentMethodToDelete.id);
    }
  };

  const setPrimaryPaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: number) => {
      const res = await apiRequest("PUT", `/api/payment-settings/${paymentMethodId}/set-primary`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-settings"] });
      toast({
        title: "Success",
        description: "Primary payment method updated successfully",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        setErrorDialog({
          open: true,
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to set primary payment method",
      });
    },
  });

  const handleSetPrimary = (method: PaymentMethod) => {
    setPrimaryPaymentMethodMutation.mutate(method.id);
  };

  // Upgrade existing e-transfer payment method with Stripe Connect
  const upgradeETransferMutation = useMutation({
    mutationFn: async (paymentMethod: PaymentMethod) => {
      // Step 1: Create Stripe Connect account
      const accountRes = await apiRequest("POST", "/api/stripe-connect/create-account");
      const accountData = await accountRes.json();

      if (!accountData.success || !accountData.accountId) {
        throw new Error(accountData.error || "Failed to create Stripe Connect account");
      }

      // Step 2: Update the existing payment setting with stripeAccountId
      const updateRes = await apiRequest("PUT", `/api/payment-settings/${paymentMethod.id}`, {
        stripeAccountId: accountData.accountId,
      });
      await updateRes.json();

      // Step 3: Get onboarding link and redirect
      const onboardingRes = await apiRequest("POST", "/api/stripe-connect/onboarding-link", {
        accountId: accountData.accountId,
        returnUrl: `${window.location.origin}/settings/payment?stripe_onboarding=success`,
        refreshUrl: `${window.location.origin}/settings/payment?stripe_onboarding=refresh`,
      });
      const onboardingData = await onboardingRes.json();

      if (!onboardingData.success || !onboardingData.url) {
        throw new Error(onboardingData.error || "Failed to create onboarding link");
      }

      // Redirect to Stripe onboarding
      window.location.href = onboardingData.url;
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        setErrorDialog({
          open: true,
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to upgrade e-transfer payment method",
      });
    },
  });

  const handleUpgradeETransfer = (method: PaymentMethod) => {
    upgradeETransferMutation.mutate(method);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const role: User["role"] = user.role;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <TopNavBar />
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payment Management</h1>
          <p className="mt-1 text-gray-600">Manage your payments and payouts</p>
        </div>

        {role === "creator" && (
          <>
            <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
              <div className="flex overflow-x-auto border-b border-gray-200">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`whitespace-nowrap px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-colors ${
                    activeTab === "overview"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Payment History
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`whitespace-nowrap px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-colors ${
                    activeTab === "settings"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Payment Methods
                </button>
            </div>
          </div>
          {activeTab === "overview" && <CreatorOverview payments={creatorPayments} />}
          {activeTab === "settings" && (
            <PaymentMethodSettings
              paymentMethods={paymentMethods}
              payoutMethod={payoutMethod}
              setPayoutMethod={setPayoutMethod}
              payoutEmail={payoutEmail}
              setPayoutEmail={setPayoutEmail}
                bankRoutingNumber={bankRoutingNumber}
                setBankRoutingNumber={setBankRoutingNumber}
                bankAccountNumber={bankAccountNumber}
                setBankAccountNumber={setBankAccountNumber}
                paypalEmail={paypalEmail}
                setPaypalEmail={setPaypalEmail}
              cryptoWalletAddress={cryptoWalletAddress}
              setCryptoWalletAddress={setCryptoWalletAddress}
              cryptoNetwork={cryptoNetwork}
              setCryptoNetwork={setCryptoNetwork}
              onAddPaymentMethod={() => addPaymentMethodMutation.mutate()}
              onDeletePaymentMethod={handleDeleteClick}
              onSetPrimary={handleSetPrimary}
              onUpgradeETransfer={handleUpgradeETransfer}
              isSubmitting={addPaymentMethodMutation.isPending}
            />
          )}
        </>
      )}

        {role === "company" && (
          <>
            <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
              <div className="flex overflow-x-auto border-b border-gray-200">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`whitespace-nowrap px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-colors ${
                    activeTab === "overview"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`whitespace-nowrap px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-colors ${
                    activeTab === "settings"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Payment Methods
                </button>
                <button
                  onClick={() => setActiveTab("approvals")}
                  className={`relative whitespace-nowrap px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-colors ${
                    activeTab === "approvals"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Pending Approvals
                  {companyPayments.filter((p) => p.status === "pending" || p.status === "processing").length > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800">
                      {companyPayments.filter((p) => p.status === "pending" || p.status === "processing").length}
                    </span>
                  )}
                </button>
              </div>
            </div>
            {activeTab === "overview" && <CompanyOverview payouts={companyPayments} />}
            {activeTab === "settings" && (
              <PaymentMethodSettings
                paymentMethods={paymentMethods}
                payoutMethod={payoutMethod}
                setPayoutMethod={setPayoutMethod}
                payoutEmail={payoutEmail}
                setPayoutEmail={setPayoutEmail}
                bankRoutingNumber={bankRoutingNumber}
                setBankRoutingNumber={setBankRoutingNumber}
                bankAccountNumber={bankAccountNumber}
                setBankAccountNumber={setBankAccountNumber}
                paypalEmail={paypalEmail}
                setPaypalEmail={setPaypalEmail}
                cryptoWalletAddress={cryptoWalletAddress}
                setCryptoWalletAddress={setCryptoWalletAddress}
                cryptoNetwork={cryptoNetwork}
                setCryptoNetwork={setCryptoNetwork}
                onAddPaymentMethod={() => addPaymentMethodMutation.mutate()}
                onDeletePaymentMethod={handleDeleteClick}
                onSetPrimary={handleSetPrimary}
                isSubmitting={addPaymentMethodMutation.isPending}
                emptyDescription="Add a payment method to fund creator payouts"
                showFeeBreakdown={false}
              />
            )}
            {activeTab === "approvals" && <CompanyPayoutApproval payouts={companyPayments} />}
          </>
        )}

        {role === "admin" && (
          <>
            <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
              <div className="flex overflow-x-auto border-b border-gray-200">
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`whitespace-nowrap px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-colors ${
                    activeTab === "dashboard"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Platform Dashboard
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`whitespace-nowrap px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-colors ${
                    activeTab === "settings"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Payment Settings
                </button>
              </div>
            </div>
            {activeTab === "dashboard" && (
              <AdminPaymentDashboard payments={allPayments} />
            )}
            {activeTab === "settings" && <AdminPaymentSettings />}
          </>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment method?
              {paymentMethodToDelete?.isDefault && (
                <span className="mt-2 block text-yellow-600 font-medium">
                  This is your primary payment method. Another payment method will be automatically set as primary.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletePaymentMethodMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        variant="error"
      />
    </div>
  );
}
