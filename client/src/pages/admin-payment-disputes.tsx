import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  AlertCircle,
  DollarSign,
  CheckCircle,
  XCircle,
  User,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import { TopNavBar } from "../components/TopNavBar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { proxiedSrc } from "../lib/image";

export default function AdminPaymentDisputes() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [resolution, setResolution] = useState<'refund' | 'complete' | 'cancel'>('complete');
  const [notes, setNotes] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  const { data: disputedPayments = [], isLoading: paymentsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/payments/disputed"],
    queryFn: async () => {
      const response = await fetch("/api/admin/payments/disputed", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch disputed payments");
      return response.json();
    },
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const resolveDisputeMutation = useMutation({
    mutationFn: async ({ id, resolution, notes }: { id: string; resolution: string; notes: string }) => {
      const response = await fetch(`/api/admin/payments/${id}/resolve-dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resolution, notes }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to resolve dispute");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments/disputed"] });
      toast({
        title: "Dispute Resolved",
        description: "The payment dispute has been successfully resolved.",
      });
      setShowDialog(false);
      setSelectedPayment(null);
      setNotes("");
      setResolution('complete');
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Error",
        message: error.message,
      });
    },
  });

  const handleResolveClick = (payment: any) => {
    setSelectedPayment(payment);
    setShowDialog(true);
  };

  const handleResolveSubmit = () => {
    if (!selectedPayment) return;

    resolveDisputeMutation.mutate({
      id: selectedPayment.id,
      resolution,
      notes,
    });
  };

  const getResolutionBadge = (resolution: string) => {
    switch (resolution) {
      case 'refund':
        return <Badge variant="destructive">Refund to Company</Badge>;
      case 'complete':
        return <Badge variant="default" className="bg-green-500">Approve Payment</Badge>;
      case 'cancel':
        return <Badge variant="secondary">Cancel Dispute</Badge>;
      default:
        return null;
    }
  };

  const extractDisputeReason = (description: string | null) => {
    if (!description) return "No reason provided";
    const match = description.match(/Disputed:\s*(.+?)(\s*\||$)/);
    return match ? match[1].trim() : description;
  };

  if (isLoading || paymentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-6">
      <TopNavBar />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment Disputes</h1>
          <p className="text-muted-foreground mt-2">
            Manage and resolve disputed payments between creators and companies
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {disputedPayments.length} Disputes
        </Badge>
      </div>

      {disputedPayments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Disputed Payments</h2>
            <p className="text-muted-foreground">
              All payments are in good standing. Disputed payments will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {disputedPayments.map((payment) => (
            <Card key={payment.id} className="border-destructive/50">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <CardTitle className="text-lg">{payment.title}</CardTitle>
                      <Badge variant="outline">
                        {payment.paymentType === 'affiliate' ? 'Affiliate' : 'Retainer'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Disputed on {format(new Date(payment.createdAt || payment.initiatedAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-destructive">
                      ${parseFloat(payment.netAmount?.toString() || '0').toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">Net Amount</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Parties Involved */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={proxiedSrc(payment.creator?.profileImageUrl)} />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {payment.creator?.firstName} {payment.creator?.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">Creator</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={proxiedSrc(payment.company?.logoUrl)} />
                      <AvatarFallback>
                        <Building2 className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {payment.company?.tradeName || payment.company?.legalName}
                      </div>
                      <div className="text-sm text-muted-foreground">Company</div>
                    </div>
                  </div>
                </div>

                {/* Dispute Reason */}
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="font-semibold mb-1 text-destructive">Dispute Reason:</div>
                  <p className="text-sm">{extractDisputeReason(payment.description)}</p>
                </div>

                {/* Payment Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
                  <div>
                    <div className="text-sm text-muted-foreground">Gross Amount</div>
                    <div className="font-semibold">
                      ${parseFloat(payment.grossAmount?.toString() || '0').toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Platform Fee</div>
                    <div className="font-semibold">
                      ${parseFloat(payment.platformFeeAmount?.toString() || '0').toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Processing Fee</div>
                    <div className="font-semibold">
                      ${parseFloat((payment.stripeFeeAmount || payment.processingFeeAmount)?.toString() || '0').toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Status</div>
                    <Badge variant="destructive">{payment.status}</Badge>
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-2">
                  <Button
                    onClick={() => handleResolveClick(payment)}
                    className="w-full"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Resolve Dispute
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Resolution Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve Payment Dispute</DialogTitle>
            <DialogDescription>
              Choose how to resolve this dispute. Both parties will be notified of your decision.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedPayment && (
              <div className="p-3 rounded-lg bg-muted space-y-2">
                <div className="font-semibold">{selectedPayment.title}</div>
                <div className="text-2xl font-bold">
                  ${parseFloat(selectedPayment.netAmount?.toString() || '0').toFixed(2)}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Resolution</label>
              <Select value={resolution} onValueChange={(value: any) => setResolution(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="complete">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Approve Payment - Release to creator</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="refund">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      <span>Refund Company - Cancel payment</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="cancel">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <span>Cancel Dispute - Keep as failed</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {getResolutionBadge(resolution)}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Resolution Notes</label>
              <Textarea
                placeholder="Add notes about this resolution decision..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                These notes will be included in notifications to both parties
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                setNotes("");
                setResolution('complete');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolveSubmit}
              disabled={resolveDisputeMutation.isPending}
            >
              {resolveDisputeMutation.isPending ? "Resolving..." : "Resolve Dispute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title || "Error"}
        description={errorDialog?.message || "An unexpected error occurred"}
      />
    </div>
  );
}
