import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  DollarSign,
  TrendingUp,
  Building,
  FileText,
  User
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

interface Payment {
  id: string;
  applicationId: string;
  offerId: string;
  companyId: string;
  creatorId: string;
  grossAmount: string;
  platformFeeAmount: string;
  stripeFeeAmount: string;
  netAmount: string;
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  description: string | null;
  completedAt: string | null;
  createdAt: string;
  offer?: {
    id: string;
    title: string;
    companyId: string;
  };
  company?: {
    id: string;
    legalName: string;
    logoUrl: string | null;
  };
}

async function fetchPaymentById(id?: string): Promise<Payment | null> {
  if (!id) return null;
  const res = await fetch(`/api/payments/${encodeURIComponent(id)}`, { 
    credentials: "include" 
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch payment");
  }
  return res.json();
}

const statusConfig = {
  pending: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    icon: Clock,
    label: "Pending Approval"
  },
  processing: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    icon: Clock,
    label: "Processing"
  },
  completed: {
    bg: "bg-green-100",
    text: "text-green-800",
    icon: CheckCircle,
    label: "Completed"
  },
  failed: {
    bg: "bg-red-100",
    text: "text-red-800",
    icon: XCircle,
    label: "Failed"
  },
  refunded: {
    bg: "bg-gray-100",
    text: "text-gray-800",
    icon: XCircle,
    label: "Refunded"
  },
  disputed: {
    bg: "bg-orange-100",
    text: "text-orange-800",
    icon: AlertTriangle,
    label: "Disputed"
  },
};

// Helper to check if a payment is disputed
function isDisputedPayment(payment: Payment): boolean {
  return payment.status === "failed" &&
    (payment.description?.toLowerCase().includes("disputed:") ?? false);
}

export default function PaymentDetail() {
  const [, params] = useRoute("/payments/:id");
  const id = params?.id as string | undefined;
  const { user } = useAuth();

  const { data: payment, isLoading, error } = useQuery<Payment | null>({
    queryKey: ["/api/payments", id],
    queryFn: () => fetchPaymentById(id),
    enabled: !!id,
  });

  // Determine if viewer is a company (payer) or creator (receiver)
  const isCompanyViewer = user?.role === 'company';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="text-center p-8">
        <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Payment Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The payment you're looking for doesn't exist or you don't have permission to view it.
        </p>
        <Link href="/payment-settings">
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Payments
          </Button>
        </Link>
      </div>
    );
  }

  // Use disputed status config if payment is disputed, otherwise use normal status
  const statusKey = isDisputedPayment(payment) ? "disputed" : payment.status;
  const statusInfo = statusConfig[statusKey];
  const StatusIcon = statusInfo.icon;

  const grossAmount = parseFloat(payment.grossAmount);
  const platformFee = parseFloat(payment.platformFeeAmount);
  const processingFee = parseFloat(payment.stripeFeeAmount);
  const netAmount = parseFloat(payment.netAmount);

  // Calculate actual platform fee percentage from payment data
  const platformFeePercentage = grossAmount > 0 ? ((platformFee / grossAmount) * 100).toFixed(platformFee / grossAmount % 0.01 === 0 ? 0 : 1) : '4';
  const processingFeePercentage = grossAmount > 0 ? ((processingFee / grossAmount) * 100).toFixed(processingFee / grossAmount % 0.01 === 0 ? 0 : 1) : '3';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/payment-settings">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Payments
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Payment Details</h1>
          <p className="text-muted-foreground mt-1">
            Transaction ID: {payment.id.slice(0, 16)}...
          </p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${statusInfo.bg}`}>
          <StatusIcon className={`h-5 w-5 ${statusInfo.text}`} />
          <span className={`font-semibold ${statusInfo.text}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Disputed Payment Alert */}
      {isDisputedPayment(payment) && (
        <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-orange-900">Payment Disputed</h3>
              <p className="text-sm text-orange-800 mt-1">
                {isCompanyViewer
                  ? "You have disputed this payment. It is currently under review by admin."
                  : "This payment has been disputed by the company and is currently under review by admin. The disputed amount is not included in your total earnings until resolved."}
              </p>
              {payment.description && (
                <p className="text-sm text-orange-700 mt-2">
                  <span className="font-medium">Reason:</span> {payment.description.replace(/^Disputed:\s*/i, '')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Amount Card */}
      <Card className="border-2">
        <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-green-600" />
            Payment Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Net Amount - Most Important */}
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 font-medium mb-1">
                    {isCompanyViewer ? "Amount Creator Receives" : "Amount You Received"}
                  </p>
                  <p className="text-4xl font-bold text-green-900">
                    ${netAmount.toFixed(2)}
                  </p>
                </div>
                {isCompanyViewer ? (
                  <User className="h-12 w-12 text-green-500" />
                ) : (
                  <CheckCircle className="h-12 w-12 text-green-500" />
                )}
              </div>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Gross Amount</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${grossAmount.toFixed(2)}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-red-600 mb-1">Platform Fee ({platformFeePercentage}%)</p>
                <p className="text-2xl font-bold text-red-700">
                  -${platformFee.toFixed(2)}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-red-600 mb-1">Processing ({processingFeePercentage}%)</p>
                <p className="text-2xl font-bold text-red-700">
                  -${processingFee.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Fee Calculation */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 font-medium mb-2">
                💡 How fees are calculated
              </p>
              <div className="text-sm text-blue-800 space-y-1">
                <div className="flex justify-between">
                  <span>Gross earnings:</span>
                  <span className="font-medium">${grossAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform fee ({platformFeePercentage}%):</span>
                  <span className="font-medium">-${platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing fee ({processingFeePercentage}%):</span>
                  <span className="font-medium">-${processingFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-blue-300">
                  <span className="font-bold">{isCompanyViewer ? "Creator receives:" : "You receive:"}</span>
                  <span className="font-bold">${netAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Offer & Company Details */}
      {payment.offer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Related Offer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Offer Title</p>
                <Link href={`/offers/${payment.offer.id}`}>
                  <p className="text-lg font-semibold text-primary hover:underline">
                    {payment.offer.title}
                  </p>
                </Link>
              </div>
              {payment.company && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <Building className="h-8 w-8 text-gray-400" />
                  <div>
                    <p className="text-sm text-muted-foreground">Company</p>
                    <p className="font-semibold">{payment.company.legalName}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Payment Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {payment.description && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-base">{payment.description}</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Created</p>
                <p className="font-medium">
                  {format(new Date(payment.createdAt), "PPP 'at' p")}
                </p>
              </div>
              
              {payment.completedAt && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Completed</p>
                  <p className="font-medium">
                    {format(new Date(payment.completedAt), "PPP 'at' p")}
                  </p>
                </div>
              )}
            </div>

            {payment.applicationId && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Application ID</p>
                <Link href={`/applications/${payment.applicationId}`}>
                  <p className="font-mono text-sm text-primary hover:underline">
                    {payment.applicationId}
                  </p>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Message */}
      {payment.status === "pending" && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-900">Payment Pending Approval</p>
                <p className="text-sm text-yellow-800 mt-1">
                  {isCompanyViewer
                    ? "This payment is pending your approval. Review and approve to process the payment to the creator."
                    : "The company is reviewing this payment. You'll receive a notification once it's approved and processed."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {payment.status === "processing" && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900">Payment Processing</p>
                <p className="text-sm text-blue-800 mt-1">
                  {isCompanyViewer
                    ? "This payment is being processed and will be sent to the creator shortly."
                    : "Your payment is being processed and will be sent to your payment method shortly."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {payment.status === "completed" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-green-900">Payment Completed</p>
                <p className="text-sm text-green-800 mt-1">
                  {isCompanyViewer
                    ? `This payment has been successfully sent to the creator on ${payment.completedAt ? format(new Date(payment.completedAt), "PPP") : ""}.`
                    : <>This payment has been successfully sent to your payment method on{" "}
                      {payment.completedAt && format(new Date(payment.completedAt), "PPP")}.</>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}