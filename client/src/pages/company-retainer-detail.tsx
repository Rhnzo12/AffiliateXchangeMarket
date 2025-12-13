import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useToast } from "../hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { DollarSign, Video, Calendar, Briefcase, CheckCircle, XCircle, Clock, ExternalLink, Play, Eye, EyeOff, Edit3, Trash2, PauseCircle, PlayCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { VideoPlayer } from "../components/VideoPlayer";
import { format } from "date-fns";
import { TopNavBar } from "../components/TopNavBar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { useForm } from "react-hook-form";
import { useCompanyPageTour } from "../components/CompanyTour";
import { COMPANY_TOUR_IDS, retainerDetailTourSteps } from "../lib/companyTourConfig";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const editRetainerSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  monthlyAmount: z.string().min(1, "Monthly amount is required"),
  videosPerMonth: z.string().min(1, "Videos per month is required"),
  durationMonths: z.string().min(1, "Duration is required"),
  requiredPlatform: z.string().min(1, "Platform is required"),
  platformAccountDetails: z.string().optional(),
  contentGuidelines: z.string().optional(),
  brandSafetyRequirements: z.string().optional(),
  minimumFollowers: z.string().optional(),
  niches: z.string().optional(),
  contentApprovalRequired: z.boolean().default(false),
  exclusivityRequired: z.boolean().default(false),
  minimumVideoLengthSeconds: z.string().optional(),
  postingSchedule: z.string().optional(),
});

type EditRetainerForm = z.infer<typeof editRetainerSchema>;

export default function CompanyRetainerDetail() {
  const [, params] = useRoute("/company/retainers/:id");
  const [, setLocation] = useLocation();
  const contractId = params?.id;
  const { toast } = useToast();
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState<any>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'request_revision' | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [showRejected, setShowRejected] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  // Edit, Delete, Suspend state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);

  // Quick tour for retainer detail page
  useCompanyPageTour(COMPANY_TOUR_IDS.RETAINER_DETAIL, retainerDetailTourSteps);

  // Use the correct API endpoint - /api/retainer-contracts/:id (not /api/company/retainer-contracts/:id)
  const { data: contract, isLoading, error } = useQuery<any>({
    queryKey: [`/api/retainer-contracts/${contractId}`],
    enabled: !!contractId,
  });

  // Use the correct API endpoint for applications
  const { data: applications } = useQuery<any[]>({
    queryKey: [`/api/retainer-contracts/${contractId}/applications`],
    enabled: !!contractId,
  });

  // Fetch deliverables if contract is assigned
  const { data: deliverables } = useQuery<any[]>({
    queryKey: [`/api/retainer-contracts/${contractId}/deliverables`],
    enabled: !!contractId && (contract?.status === 'in_progress' || !!contract?.assignedCreatorId),
  });

  // Edit form
  const editForm = useForm<EditRetainerForm>({
    resolver: zodResolver(editRetainerSchema),
    defaultValues: {
      title: "",
      description: "",
      monthlyAmount: "",
      videosPerMonth: "",
      durationMonths: "3",
      requiredPlatform: "",
      platformAccountDetails: "",
      contentGuidelines: "",
      brandSafetyRequirements: "",
      minimumFollowers: "",
      niches: "",
      contentApprovalRequired: false,
      exclusivityRequired: false,
      minimumVideoLengthSeconds: "",
      postingSchedule: "",
    },
  });

  // Populate edit form when contract data is loaded
  useEffect(() => {
    if (contract && editDialogOpen) {
      editForm.reset({
        title: contract.title || "",
        description: contract.description || "",
        monthlyAmount: contract.monthlyAmount?.toString() || "",
        videosPerMonth: contract.videosPerMonth?.toString() || "",
        durationMonths: contract.durationMonths?.toString() || "3",
        requiredPlatform: contract.requiredPlatform || "",
        platformAccountDetails: contract.platformAccountDetails || "",
        contentGuidelines: contract.contentGuidelines || "",
        brandSafetyRequirements: contract.brandSafetyRequirements || "",
        minimumFollowers: contract.minimumFollowers?.toString() || "",
        niches: contract.niches?.join(", ") || "",
        contentApprovalRequired: contract.contentApprovalRequired || false,
        exclusivityRequired: contract.exclusivityRequired || false,
        minimumVideoLengthSeconds: contract.minimumVideoLengthSeconds?.toString() || "",
        postingSchedule: contract.postingSchedule || "",
      });
    }
  }, [contract, editDialogOpen]);

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async (data: EditRetainerForm) => {
      const payload = {
        ...data,
        monthlyAmount: parseFloat(data.monthlyAmount),
        videosPerMonth: parseInt(data.videosPerMonth),
        durationMonths: parseInt(data.durationMonths),
        minimumFollowers: data.minimumFollowers ? parseInt(data.minimumFollowers) : null,
        niches: data.niches ? data.niches.split(",").map((n) => n.trim()).filter(Boolean) : [],
        minimumVideoLengthSeconds: data.minimumVideoLengthSeconds
          ? parseInt(data.minimumVideoLengthSeconds)
          : null,
      };
      return await apiRequest("PATCH", `/api/company/retainer-contracts/${contractId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/company/retainer-contracts"] });
      toast({
        title: "Retainer Updated",
        description: "Your retainer contract has been updated successfully.",
      });
      setEditDialogOpen(false);
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to update retainer contract",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/company/retainer-contracts/${contractId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/retainer-contracts"] });
      toast({
        title: "Retainer Deleted",
        description: "The retainer contract has been deleted.",
      });
      setDeleteDialogOpen(false);
      setLocation("/company/retainers");
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to delete retainer contract",
      });
    },
  });

  // Suspend/Resume mutation
  const suspendMutation = useMutation({
    mutationFn: async (newStatus: 'paused' | 'open' | 'in_progress') => {
      return await apiRequest("PATCH", `/api/company/retainer-contracts/${contractId}`, {
        status: newStatus,
      });
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/company/retainer-contracts"] });
      toast({
        title: newStatus === 'paused' ? "Retainer Suspended" : "Retainer Resumed",
        description: newStatus === 'paused'
          ? "The retainer contract has been suspended."
          : "The retainer contract has been resumed.",
      });
      setSuspendDialogOpen(false);
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to update retainer status",
      });
    },
  });

  const handleEditSubmit = (data: EditRetainerForm) => {
    editMutation.mutate(data);
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const handleSuspendResume = () => {
    if (contract?.status === 'paused') {
      // Resume - go back to open or in_progress depending on whether there's an assigned creator
      const newStatus = contract.assignedCreatorId ? 'in_progress' : 'open';
      suspendMutation.mutate(newStatus);
    } else {
      // Suspend
      suspendMutation.mutate('paused');
    }
  };

  const approveMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      return await apiRequest("PATCH", `/api/company/retainer-applications/${applicationId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}/applications`] });
      queryClient.invalidateQueries({ queryKey: ["/api/company/retainer-contracts"] });
      toast({
        title: "Application Approved",
        description: "The creator has been assigned to this retainer contract.",
      });
      setApproveDialogOpen(false);
      setSelectedApplication(null);
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to approve application",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      return await apiRequest("PATCH", `/api/company/retainer-applications/${applicationId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}/applications`] });
      queryClient.invalidateQueries({ queryKey: ["/api/company/retainer-contracts"] });
      toast({
        title: "Application Rejected",
        description: "The application has been rejected.",
      });
      setRejectDialogOpen(false);
      setSelectedApplication(null);
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to reject application",
      });
    },
  });

  const handleApprove = (application: any) => {
    setSelectedApplication(application);
    setApproveDialogOpen(true);
  };

  const handleReject = (application: any) => {
    setSelectedApplication(application);
    setRejectDialogOpen(true);
  };

  // Deliverable review mutations
  const approveDeliverableMutation = useMutation({
    mutationFn: async (data: { deliverableId: string; reviewNotes?: string }) => {
      return await apiRequest("PATCH", `/api/company/retainer-deliverables/${data.deliverableId}/approve`, {
        reviewNotes: data.reviewNotes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}/deliverables`] });
      toast({
        title: "Deliverable Approved",
        description: "The deliverable has been approved and payment has been processed.",
      });
      setReviewDialogOpen(false);
      setSelectedDeliverable(null);
      setReviewNotes("");
      setReviewAction(null);
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to approve deliverable",
      });
    },
  });

  const rejectDeliverableMutation = useMutation({
    mutationFn: async (data: { deliverableId: string; reviewNotes: string }) => {
      return await apiRequest("PATCH", `/api/company/retainer-deliverables/${data.deliverableId}/reject`, {
        reviewNotes: data.reviewNotes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}/deliverables`] });
      toast({
        title: "Deliverable Rejected",
        description: "The creator has been notified of the rejection.",
      });
      setReviewDialogOpen(false);
      setSelectedDeliverable(null);
      setReviewNotes("");
      setReviewAction(null);
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to reject deliverable",
      });
    },
  });

  const requestRevisionMutation = useMutation({
    mutationFn: async (data: { deliverableId: string; reviewNotes: string }) => {
      return await apiRequest("PATCH", `/api/company/retainer-deliverables/${data.deliverableId}/request-revision`, {
        reviewNotes: data.reviewNotes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}/deliverables`] });
      toast({
        title: "Revision Requested",
        description: "The creator has been notified to revise the deliverable.",
      });
      setReviewDialogOpen(false);
      setSelectedDeliverable(null);
      setReviewNotes("");
      setReviewAction(null);
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to request revision",
      });
    },
  });

  const handleReviewDeliverable = (deliverable: any, action: 'approve' | 'reject' | 'request_revision') => {
    setSelectedDeliverable(deliverable);
    setReviewAction(action);
    setReviewDialogOpen(true);
  };

  const handleSubmitReview = () => {
    if (!selectedDeliverable || !reviewAction) return;

    const data = {
      deliverableId: selectedDeliverable.id,
      reviewNotes: reviewNotes.trim(),
    };

    if (reviewAction === 'approve') {
      approveDeliverableMutation.mutate(data);
    } else if (reviewAction === 'reject') {
      if (!reviewNotes.trim()) {
        setErrorDialog({
          title: "Review Notes Required",
          message: "Please provide a reason for rejection",
        });
        return;
      }
      rejectDeliverableMutation.mutate(data as { deliverableId: string; reviewNotes: string });
    } else if (reviewAction === 'request_revision') {
      if (!reviewNotes.trim()) {
        setErrorDialog({
          title: "Review Notes Required",
          message: "Please provide revision instructions",
        });
        return;
      }
      requestRevisionMutation.mutate(data as { deliverableId: string; reviewNotes: string });
    }
  };

  const getDeliverableStatusBadge = (status: string) => {
    switch (status) {
      case "pending_review":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending Review</Badge>;
      case "approved":
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "revision_requested":
        return <Badge variant="default"><Clock className="h-3 w-3 mr-1" />Revision Requested</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Loading...</h1>
          <p className="text-muted-foreground">Fetching contract details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Contract</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {(error as Error)?.message || "Failed to load contract"}
              </p>
              <Link href="/company/retainers">
                <Button className="mt-4">Back to Retainers</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Contract Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-muted-foreground">
                The retainer contract you're looking for doesn't exist.
              </p>
              <Link href="/company/retainers">
                <Button className="mt-4">Back to Retainers</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isContractAssigned = contract.status === 'in_progress' || !!contract.assignedCreatorId;

  const getContractStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="secondary">Open</Badge>;
      case 'in_progress':
        return <Badge variant="default">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'paused':
        return <Badge variant="outline" className="border-amber-500 text-amber-600"><PauseCircle className="h-3 w-3 mr-1" />Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const canEditContract = contract?.status !== 'completed' && contract?.status !== 'cancelled';
  const canSuspendContract = contract?.status === 'open' || contract?.status === 'in_progress' || contract?.status === 'paused';
  const canDeleteContract = contract?.status === 'open' && !contract?.assignedCreatorId;

  return (
    <div className="space-y-6">
      <TopNavBar />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{contract.title}</h1>
          <p className="text-muted-foreground">Retainer Contract Details</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {getContractStatusBadge(contract.status)}

          {canEditContract && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditDialogOpen(true)}
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}

          {canSuspendContract && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSuspendDialogOpen(true)}
              className={contract.status === 'paused' ? 'border-green-500 text-green-600 hover:bg-green-50' : 'border-amber-500 text-amber-600 hover:bg-amber-50'}
            >
              {contract.status === 'paused' ? (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Resume
                </>
              ) : (
                <>
                  <PauseCircle className="h-4 w-4 mr-2" />
                  Suspend
                </>
              )}
            </Button>
          )}

          {canDeleteContract && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              className="border-destructive text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contract Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{contract.description}</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Payment</p>
                <p className="font-semibold">
                  ${parseFloat(contract.monthlyAmount).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Videos/Month</p>
                <p className="font-semibold">{contract.videosPerMonth}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-semibold">{contract.durationMonths} months</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Platform</p>
                <p className="font-semibold">{contract.requiredPlatform}</p>
              </div>
            </div>
          </div>

          {contract.contentGuidelines && (
            <div className="pt-4 border-t">
              <h4 className="font-semibold text-sm mb-2">Content Guidelines</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {contract.contentGuidelines}
              </p>
            </div>
          )}

          {contract.assignedCreator && (
            <div className="pt-4 border-t">
              <h4 className="font-semibold text-sm mb-2">Assigned Creator</h4>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {contract.assignedCreator.firstName?.[0]}{contract.assignedCreator.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {contract.assignedCreator.firstName} {contract.assignedCreator.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">@{contract.assignedCreator.username}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Applications</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {applications?.length || 0} Application{applications?.length !== 1 ? 's' : ''}
              </Badge>
              {(applications?.filter((a: any) => a.status === 'rejected') ?? []).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRejected(!showRejected)}
                >
                  {showRejected ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-1" />
                      Hide Rejected
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-1" />
                      Show Rejected
                    </>
                  )} ({(applications?.filter((a: any) => a.status === 'rejected') ?? []).length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!applications || applications.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No applications yet</p>
            </div>
          ) : applications.filter((application: any) => showRejected || application.status !== 'rejected').length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">All applications are rejected. Click "Show Rejected" to view them.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {applications
                .filter((application: any) => showRejected || application.status !== 'rejected')
                .map((application: any) => (
                <Card key={application.id} className="border-card-border">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback>
                            {application.creator?.firstName?.[0]}{application.creator?.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold">
                                {application.creator?.firstName} {application.creator?.lastName}
                              </h4>
                              {getStatusBadge(application.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              @{application.creator?.username}
                            </p>
                          </div>

                          <div>
                            <h5 className="text-sm font-medium mb-1">Message</h5>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {application.message}
                            </p>
                          </div>

                          {application.portfolioLinks && application.portfolioLinks.length > 0 && (
                            <div>
                              <h5 className="text-sm font-medium mb-2">Portfolio Links</h5>
                              <div className="flex flex-wrap gap-2">
                                {application.portfolioLinks.map((link: string, index: number) => (
                                  <a
                                    key={index}
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Link {index + 1}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {application.proposedStartDate && (
                            <div>
                              <h5 className="text-sm font-medium">Proposed Start Date</h5>
                              <p className="text-sm text-muted-foreground">
                                {new Date(application.proposedStartDate).toLocaleDateString()}
                              </p>
                            </div>
                          )}

                          <div className="flex gap-2 pt-2">
                            {application.status === 'pending' && (
                              <>
                                <Button
                                  onClick={() => handleApprove(application)}
                                  size="sm"
                                  disabled={isContractAssigned}
                                  className="bg-green-500 hover:bg-green-600"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>
                                <Button
                                  onClick={() => handleReject(application)}
                                  variant="destructive"
                                  size="sm"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </>
                            )}
                            {application.status === 'approved' && (
                              <Button
                                disabled
                                size="sm"
                                className="bg-green-500"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approved
                              </Button>
                            )}
                            {application.status === 'rejected' && (
                              <Button
                                disabled
                                variant="destructive"
                                size="sm"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Rejected
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deliverables Section - Only show if contract is assigned */}
      {isContractAssigned && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Submitted Deliverables</CardTitle>
              <Badge variant="outline">
                {deliverables?.length || 0} Video{deliverables?.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {!deliverables || deliverables.length === 0 ? (
              <div className="text-center py-12">
                <Video className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No deliverables submitted yet</p>
              </div>
            ) : (
              <div className="space-y-6">
                {deliverables.map((deliverable: any) => (
                  <Card key={deliverable.id} className="border-card-border">
                    <CardContent className="pt-6">
                      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
                        {/* Left Column: Video & Submitter */}
                        <div className="space-y-3">
                          {/* Video Thumbnail/Player */}
                          <div className="rounded-lg overflow-hidden bg-black border-2 border-border">
                            <VideoPlayer
                              videoUrl={deliverable.videoUrl}
                              className="w-full aspect-video"
                            />
                          </div>

                          {/* Submitter Info Card */}
                          {contract.assignedCreator && (
                            <Card className="bg-muted/30 border-muted">
                              <CardContent className="p-4">
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-3">
                                  Submitted By
                                </p>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-12 w-12 border-2 border-background">
                                    <AvatarFallback className="text-base font-semibold">
                                      {contract.assignedCreator.firstName?.[0]}
                                      {contract.assignedCreator.lastName?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate">
                                      {contract.assignedCreator.email}
                                    </p>
                                    <p className="text-sm text-muted-foreground truncate">
                                      @{contract.assignedCreator.username}
                                    </p>
                                  </div>
                                </div>

                                {/* Submission Time */}
                                {deliverable.submittedAt && (
                                  <div className="mt-3 pt-3 border-t border-border/50">
                                    <p className="text-xs text-muted-foreground">
                                      📅 {format(new Date(deliverable.submittedAt), "MMM d, yyyy")}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      🕐 {format(new Date(deliverable.submittedAt), "h:mm a")}
                                    </p>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          )}
                        </div>

                        {/* Right Column: Details & Actions */}
                        <div className="space-y-4">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-xl font-bold">{deliverable.title}</h3>
                                {getDeliverableStatusBadge(deliverable.status)}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant="outline" className="font-normal">
                                  Month {deliverable.monthNumber}
                                </Badge>
                                <span>•</span>
                                <Badge variant="outline" className="font-normal">
                                  Video #{deliverable.videoNumber}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Description */}
                          {deliverable.description && (
                            <div className="bg-muted/30 p-4 rounded-lg">
                              <h4 className="font-semibold text-sm mb-2">Description</h4>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {deliverable.description}
                              </p>
                            </div>
                          )}

                          {/* Platform Link */}
                          {deliverable.platformUrl && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(deliverable.platformUrl, "_blank")}
                                className="w-full sm:w-auto"
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View on {contract.requiredPlatform || 'Platform'}
                              </Button>
                            </div>
                          )}

                          {/* Review Notes */}
                          {deliverable.reviewNotes && (
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                <span>📝</span> Review Notes
                              </h4>
                              <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                                {deliverable.reviewNotes}
                              </p>
                              {deliverable.reviewedAt && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Reviewed {format(new Date(deliverable.reviewedAt), "MMM d, yyyy 'at' h:mm a")}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          {deliverable.status === 'pending_review' && (
                            <div className="pt-4 border-t">
                              <p className="text-sm font-medium mb-3">Review Actions</p>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  onClick={() => handleReviewDeliverable(deliverable, 'approve')}
                                  size="sm"
                                  className="bg-green-500 hover:bg-green-600 flex-1 sm:flex-none"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve & Pay
                                </Button>
                                <Button
                                  onClick={() => handleReviewDeliverable(deliverable, 'request_revision')}
                                  size="sm"
                                  variant="secondary"
                                  className="flex-1 sm:flex-none"
                                >
                                  Request Revision
                                </Button>
                                <Button
                                  onClick={() => handleReviewDeliverable(deliverable, 'reject')}
                                  size="sm"
                                  variant="destructive"
                                  className="flex-1 sm:flex-none"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deliverable Review Dialog */}
      <AlertDialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reviewAction === 'approve' && 'Approve Deliverable'}
              {reviewAction === 'reject' && 'Reject Deliverable'}
              {reviewAction === 'request_revision' && 'Request Revision'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {reviewAction === 'approve' && (
                <>
                  Are you sure you want to approve this deliverable? Payment will be automatically calculated and processed.
                </>
              )}
              {reviewAction === 'reject' && (
                <>
                  Please provide a reason for rejecting this deliverable. The creator will be notified.
                </>
              )}
              {reviewAction === 'request_revision' && (
                <>
                  Please provide specific instructions for the revision. The creator will be notified to resubmit.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder={
                reviewAction === 'approve'
                  ? "Optional: Add notes about the approval"
                  : reviewAction === 'reject'
                  ? "Required: Explain why this deliverable is being rejected"
                  : "Required: Provide specific revision instructions"
              }
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={4}
              className="w-full"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setReviewDialogOpen(false);
              setReviewNotes("");
              setReviewAction(null);
              setSelectedDeliverable(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitReview}
              disabled={
                approveDeliverableMutation.isPending ||
                rejectDeliverableMutation.isPending ||
                requestRevisionMutation.isPending
              }
              className={
                reviewAction === 'approve'
                  ? "bg-green-500 hover:bg-green-600"
                  : reviewAction === 'reject'
                  ? "bg-destructive hover:bg-destructive/90"
                  : ""
              }
            >
              {approveDeliverableMutation.isPending ||
              rejectDeliverableMutation.isPending ||
              requestRevisionMutation.isPending
                ? "Processing..."
                : reviewAction === 'approve'
                ? "Approve & Process Payment"
                : reviewAction === 'reject'
                ? "Reject Deliverable"
                : "Request Revision"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this application? This will assign{" "}
              <span className="font-semibold">
                {selectedApplication?.creator?.firstName} {selectedApplication?.creator?.lastName}
              </span>{" "}
              to this retainer contract and change the contract status to "In Progress".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => approveMutation.mutate(selectedApplication?.id)}
              disabled={approveMutation.isPending}
              className="bg-green-500 hover:bg-green-600"
            >
              {approveMutation.isPending ? "Approving..." : "Approve Application"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this application from{" "}
              <span className="font-semibold">
                {selectedApplication?.creator?.firstName} {selectedApplication?.creator?.lastName}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectMutation.mutate(selectedApplication?.id)}
              disabled={rejectMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Application"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Retainer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Retainer Contract</DialogTitle>
            <DialogDescription>
              Update your retainer contract details
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., TikTok Lifestyle Content - 30 Videos/Month"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the type of content, brand voice, target audience, etc."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="monthlyAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Payment ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="5000.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="videosPerMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Videos Per Month</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="30-50"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="durationMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Duration (Months)</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value || "3"}
                          className="grid grid-cols-2 gap-2"
                        >
                          {["1", "3", "6", "12"].map((value) => (
                            <label
                              key={value}
                              className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer transition-all ${
                                field.value === value
                                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                  : "hover:border-primary hover:bg-accent"
                              }`}
                            >
                              <RadioGroupItem value={value} />
                              <span className={`font-medium ${field.value === value ? "text-primary" : ""}`}>
                                {value} month{value === "1" ? "" : "s"}
                              </span>
                            </label>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="requiredPlatform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Required Platform</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select platform" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="TikTok">TikTok</SelectItem>
                          <SelectItem value="Instagram">Instagram Reels</SelectItem>
                          <SelectItem value="YouTube Shorts">YouTube Shorts</SelectItem>
                          <SelectItem value="Facebook Reels">Facebook Reels</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="platformAccountDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform Account Details (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Creator will be given access to @brandname account"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="contentGuidelines"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content Guidelines (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Specific content requirements, posting schedule, editing style, etc."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="brandSafetyRequirements"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand Safety Requirements (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Topics to avoid, brand safety guidelines, compliance requirements, etc."
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="minimumVideoLengthSeconds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Video Length (seconds)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="45"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="postingSchedule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Posting Schedule</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 1 video every weekday"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="contentApprovalRequired"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-1">
                        <FormLabel className="text-base">Content approval required</FormLabel>
                        <FormDescription>Review videos before they go live</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="exclusivityRequired"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-1">
                        <FormLabel className="text-base">Exclusivity</FormLabel>
                        <FormDescription>Prevent creators from working with competitors</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="minimumFollowers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Followers (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="10000"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="niches"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Niches (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Fashion, Lifestyle, Beauty"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Comma-separated
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editMutation.isPending}
                >
                  {editMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Retainer Contract
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this retainer contract? This action cannot be undone.
              <br /><br />
              <span className="font-semibold text-foreground">"{contract.title}"</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Contract"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend/Resume Confirmation Dialog */}
      <AlertDialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {contract.status === 'paused' ? (
                <>
                  <PlayCircle className="h-5 w-5 text-green-600" />
                  Resume Retainer Contract
                </>
              ) : (
                <>
                  <PauseCircle className="h-5 w-5 text-amber-600" />
                  Suspend Retainer Contract
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {contract.status === 'paused' ? (
                <>
                  Are you sure you want to resume this retainer contract? The contract will become active again
                  {contract.assignedCreatorId ? " and the assigned creator can continue submitting deliverables" : " and creators can apply to it"}.
                </>
              ) : (
                <>
                  Are you sure you want to suspend this retainer contract? While suspended:
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Creators won't be able to apply to this contract</li>
                    <li>Assigned creators won't be able to submit new deliverables</li>
                    <li>No new payments will be processed</li>
                  </ul>
                  <p className="mt-2">You can resume the contract at any time.</p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspendResume}
              disabled={suspendMutation.isPending}
              className={contract.status === 'paused' ? "bg-green-500 hover:bg-green-600" : "bg-amber-500 hover:bg-amber-600"}
            >
              {suspendMutation.isPending
                ? "Processing..."
                : contract.status === 'paused'
                ? "Resume Contract"
                : "Suspend Contract"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Dialog */}
      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title || "Error"}
        description={errorDialog?.message || "An error occurred"}
      />
    </div>
  );
}