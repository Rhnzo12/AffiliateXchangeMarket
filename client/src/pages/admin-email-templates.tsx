import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";
import {
  Plus,
  Pencil,
  Trash2,
  Mail,
  Eye,
  Copy,
  AlertCircle,
  CheckCircle,
  User,
  Building,
  FileText,
  Sparkles,
  DollarSign,
  RefreshCw,
} from "lucide-react";
import { TopNavBar } from "../components/TopNavBar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import {
  VisualEmailBuilder,
  VisualEmailData,
  visualBlocksToHtml,
  createEmptyVisualData,
  EmailBlock,
} from "../components/visual-email-builder";

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  category: string;
  subject: string;
  htmlContent: string;
  visualData: VisualEmailData | null;
  description: string | null;
  availableVariables: string[];
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TemplateType {
  type: string;
  category: string;
  name: string;
  description: string;
  slug: string;
  variables: Array<{
    name: string;
    description: string;
    example: string;
  }>;
}

const CATEGORIES = [
  { value: 'application', label: 'Application', icon: FileText, description: 'Application status updates' },
  { value: 'payment', label: 'Payment', icon: DollarSign, description: 'Payment notifications' },
  { value: 'offer', label: 'Offer', icon: Sparkles, description: 'Offer approvals and updates' },
  { value: 'company', label: 'Company', icon: Building, description: 'Company registration' },
  { value: 'system', label: 'System', icon: AlertCircle, description: 'System announcements' },
  { value: 'moderation', label: 'Moderation', icon: AlertCircle, description: 'Content moderation' },
  { value: 'authentication', label: 'Authentication', icon: User, description: 'Login and security' },
];

// Pre-built templates for each notification type
const DEFAULT_TEMPLATE_DATA: Record<string, {
  headerTitle: string;
  headerColor: string;
  blocks: EmailBlock[];
  subject: string;
}> = {
  'application-status-change': {
    headerTitle: 'Application Update',
    headerColor: '#10B981',
    subject: 'Your application status has been updated',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'success-box', content: 'Your application for {{offerTitle}} has been updated!', properties: {} },
      { id: '3', type: 'text', content: 'Please log in to view the details and next steps.', properties: {} },
      { id: '4', type: 'button', content: 'View Application', properties: { url: '{{linkUrl}}', color: 'success' } },
      { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'new-application': {
    headerTitle: 'New Application Received',
    headerColor: '#4F46E5',
    subject: 'New application for {{offerTitle}}',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'info-box', content: 'You have received a new application for your offer: {{offerTitle}}', properties: {} },
      { id: '3', type: 'text', content: 'Please review the application and respond to the creator.', properties: {} },
      { id: '4', type: 'button', content: 'Review Application', properties: { url: '{{linkUrl}}', color: 'primary' } },
      { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'payment-received': {
    headerTitle: 'Payment Received!',
    headerColor: '#10B981',
    subject: 'Payment received: {{amount}}',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'success-box', content: 'Great news! You have received a payment.', properties: {} },
      { id: '3', type: 'amount-display', content: '{{amount}}', properties: { label: 'Amount Received', style: 'success' } },
      { id: '4', type: 'details-table', content: 'Gross Amount:{{grossAmount}}\nPlatform Fee:{{platformFee}}\nProcessing Fee:{{processingFee}}\nTransaction ID:{{transactionId}}', properties: {} },
      { id: '5', type: 'button', content: 'View Payment Details', properties: { url: '{{linkUrl}}', color: 'success' } },
      { id: '6', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'payment-pending': {
    headerTitle: 'Payment Pending Review',
    headerColor: '#F59E0B',
    subject: 'New payment ready for processing',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'warning-box', content: 'A new affiliate payment is ready for processing and requires your review.', properties: {} },
      { id: '3', type: 'amount-display', content: '{{amount}}', properties: { label: 'Payment Amount', style: 'warning' } },
      { id: '4', type: 'text', content: 'Please review and process this payment at your earliest convenience.', properties: {} },
      { id: '5', type: 'button', content: 'Review Payment', properties: { url: '{{linkUrl}}', color: 'warning' } },
      { id: '6', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'payment-approved': {
    headerTitle: 'Payment Sent Successfully',
    headerColor: '#10B981',
    subject: 'Payment sent: {{amount}}',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'success-box', content: 'Your payment has been successfully sent!', properties: {} },
      { id: '3', type: 'amount-display', content: '{{amount}}', properties: { label: 'Amount Sent', style: 'success' } },
      { id: '4', type: 'text', content: 'The payment has been processed and sent to the creator.', properties: {} },
      { id: '5', type: 'button', content: 'View Details', properties: { url: '{{linkUrl}}', color: 'success' } },
      { id: '6', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'offer-approved': {
    headerTitle: 'Offer Approved!',
    headerColor: '#10B981',
    subject: 'Your offer "{{offerTitle}}" has been approved!',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'success-box', content: 'Congratulations! Your offer "{{offerTitle}}" has been approved and is now live on the marketplace.', properties: {} },
      { id: '3', type: 'text', content: 'Creators can now discover and apply to your offer.', properties: {} },
      { id: '4', type: 'button', content: 'View Your Offer', properties: { url: '{{linkUrl}}', color: 'success' } },
      { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'offer-rejected': {
    headerTitle: 'Offer Review Update',
    headerColor: '#6B7280',
    subject: 'Update on your offer submission',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'info-box', content: 'Your offer "{{offerTitle}}" requires some adjustments before it can be published.', properties: {} },
      { id: '3', type: 'text', content: 'Please review the feedback and make the necessary changes to resubmit your offer.', properties: {} },
      { id: '4', type: 'button', content: 'View Offer', properties: { url: '{{linkUrl}}', color: 'gray' } },
      { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'registration-approved': {
    headerTitle: 'Welcome to AffiliateXchange!',
    headerColor: '#4F46E5',
    subject: 'Your account has been approved!',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'success-box', content: 'Great news! Your company account has been approved.', properties: {} },
      { id: '3', type: 'text', content: 'You can now start creating offers and connecting with creators on our platform.', properties: {} },
      { id: '4', type: 'button', content: 'Get Started', properties: { url: '{{linkUrl}}', color: 'primary' } },
      { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'registration-rejected': {
    headerTitle: 'Account Registration Update',
    headerColor: '#6B7280',
    subject: 'Update on your registration',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'text', content: 'Thank you for your interest in AffiliateXchange. Unfortunately, we are unable to approve your company account at this time.', properties: {} },
      { id: '3', type: 'info-box', content: 'If you believe this is an error or would like more information, please contact our support team.', properties: {} },
      { id: '4', type: 'button', content: 'Contact Support', properties: { url: '{{linkUrl}}', color: 'gray' } },
      { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.', properties: {} },
    ],
  },
  'new-message': {
    headerTitle: 'New Message',
    headerColor: '#4F46E5',
    subject: 'New message from {{companyName}}',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'text', content: 'You have a new message from {{companyName}} regarding {{offerTitle}}.', properties: {} },
      { id: '3', type: 'info-box', content: '"{{messagePreview}}"', properties: {} },
      { id: '4', type: 'button', content: 'View Message', properties: { url: '{{linkUrl}}', color: 'primary' } },
      { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'review-received': {
    headerTitle: 'New Review Received',
    headerColor: '#4F46E5',
    subject: 'New review received ({{reviewRating}} stars)',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'text', content: 'You have received a new review for your company!', properties: {} },
      { id: '3', type: 'info-box', content: '{{reviewRating}} out of 5 stars\n\n"{{reviewText}}"', properties: {} },
      { id: '4', type: 'button', content: 'View Review', properties: { url: '{{linkUrl}}', color: 'primary' } },
      { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'email-verification': {
    headerTitle: 'Verify Your Email',
    headerColor: '#4F46E5',
    subject: 'Verify your email address',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'text', content: 'Thank you for registering with AffiliateXchange. Please verify your email address to complete your registration.', properties: {} },
      { id: '3', type: 'button', content: 'Verify Email Address', properties: { url: '{{verificationUrl}}', color: 'primary' } },
      { id: '4', type: 'warning-box', content: 'This verification link will expire in 24 hours.', properties: {} },
      { id: '5', type: 'text', content: 'If you did not create an account, you can safely ignore this email.', properties: {} },
      { id: '6', type: 'footer', content: 'This is an automated email from AffiliateXchange.', properties: {} },
    ],
  },
  'password-reset': {
    headerTitle: 'Password Reset Request',
    headerColor: '#F59E0B',
    subject: 'Reset your password',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'text', content: 'We received a request to reset your password. Click the button below to create a new password.', properties: {} },
      { id: '3', type: 'button', content: 'Reset Password', properties: { url: '{{resetUrl}}', color: 'warning' } },
      { id: '4', type: 'warning-box', content: 'This link will expire in 1 hour.', properties: {} },
      { id: '5', type: 'text', content: 'If you did not request a password reset, you can safely ignore this email.', properties: {} },
      { id: '6', type: 'footer', content: 'This is an automated email from AffiliateXchange.', properties: {} },
    ],
  },
  'account-deletion-otp': {
    headerTitle: 'Account Deletion Request',
    headerColor: '#EF4444',
    subject: 'Account Deletion Verification Code',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'text', content: 'We received a request to delete your account. Use the verification code below to confirm:', properties: {} },
      { id: '3', type: 'amount-display', content: '{{otpCode}}', properties: { label: 'Verification Code', style: 'warning' } },
      { id: '4', type: 'error-box', content: 'Warning: Account deletion is permanent and cannot be undone. All your data will be permanently deleted.', properties: {} },
      { id: '5', type: 'text', content: 'This code will expire in 15 minutes. If you did not request this, please ignore this email.', properties: {} },
      { id: '6', type: 'footer', content: 'This is an automated email from AffiliateXchange.', properties: {} },
    ],
  },
  'password-change-otp': {
    headerTitle: 'Password Change Request',
    headerColor: '#F59E0B',
    subject: 'Password Change Verification Code',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'text', content: 'We received a request to change your password. Use the verification code below to confirm:', properties: {} },
      { id: '3', type: 'amount-display', content: '{{otpCode}}', properties: { label: 'Verification Code', style: 'warning' } },
      { id: '4', type: 'warning-box', content: 'This code will expire in 15 minutes. Do not share this code with anyone.', properties: {} },
      { id: '5', type: 'text', content: 'If you did not request a password change, please secure your account immediately.', properties: {} },
      { id: '6', type: 'footer', content: 'This is an automated email from AffiliateXchange.', properties: {} },
    ],
  },
  'system-announcement': {
    headerTitle: 'System Announcement',
    headerColor: '#4F46E5',
    subject: '{{announcementTitle}}',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'heading', content: '{{announcementTitle}}', properties: { size: 'medium' } },
      { id: '3', type: 'text', content: '{{announcementMessage}}', properties: {} },
      { id: '4', type: 'button', content: 'Learn More', properties: { url: '{{linkUrl}}', color: 'primary' } },
      { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'content-flagged': {
    headerTitle: 'Content Under Review',
    headerColor: '#F59E0B',
    subject: 'Your content is under review',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'warning-box', content: 'Your content has been flagged for review by our moderation system.', properties: {} },
      { id: '3', type: 'text', content: 'Our moderation team will review your content and you will be notified of the outcome.', properties: {} },
      { id: '4', type: 'info-box', content: 'What happens next:\n- Our team will review your content\n- You will be notified once review is complete\n- If action is required, we will provide details', properties: {} },
      { id: '5', type: 'button', content: 'View Details', properties: { url: '{{linkUrl}}', color: 'warning' } },
      { id: '6', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'work-completion-approval': {
    headerTitle: 'Work Approved!',
    headerColor: '#10B981',
    subject: 'Work approved for {{offerTitle}}',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'success-box', content: 'Congratulations! Your work for "{{offerTitle}}" has been approved.', properties: {} },
      { id: '3', type: 'amount-display', content: '{{amount}}', properties: { label: 'Your Payment', style: 'success' } },
      { id: '4', type: 'text', content: 'Your payment has been initiated and will be processed shortly.', properties: {} },
      { id: '5', type: 'button', content: 'View Details', properties: { url: '{{linkUrl}}', color: 'success' } },
      { id: '6', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'priority-listing-expiring': {
    headerTitle: 'Priority Listing Expiring',
    headerColor: '#F59E0B',
    subject: 'Priority listing expiring soon',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'warning-box', content: 'Your priority listing for "{{offerTitle}}" will expire in {{daysUntilExpiration}} days.', properties: {} },
      { id: '3', type: 'text', content: 'Renew now to keep your offer at the top of search results and maintain maximum visibility.', properties: {} },
      { id: '4', type: 'button', content: 'Renew Priority Listing', properties: { url: '{{linkUrl}}', color: 'warning' } },
      { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'payment-disputed': {
    headerTitle: 'Payment Dispute',
    headerColor: '#EF4444',
    subject: 'Payment dispute initiated',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'error-box', content: 'A payment dispute has been initiated.', properties: {} },
      { id: '3', type: 'text', content: 'Please review the dispute details and respond as soon as possible.', properties: {} },
      { id: '4', type: 'button', content: 'View Dispute', properties: { url: '{{linkUrl}}', color: 'danger' } },
      { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'payment-dispute-resolved': {
    headerTitle: 'Dispute Resolved',
    headerColor: '#10B981',
    subject: 'Payment dispute resolved',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'success-box', content: 'The payment dispute has been resolved.', properties: {} },
      { id: '3', type: 'text', content: 'Please log in to view the resolution details.', properties: {} },
      { id: '4', type: 'button', content: 'View Details', properties: { url: '{{linkUrl}}', color: 'success' } },
      { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'payment-refunded': {
    headerTitle: 'Payment Refunded',
    headerColor: '#3B82F6',
    subject: 'Payment has been refunded',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'info-box', content: 'A payment refund has been processed.', properties: {} },
      { id: '3', type: 'amount-display', content: '{{amount}}', properties: { label: 'Refunded Amount', style: 'default' } },
      { id: '4', type: 'button', content: 'View Details', properties: { url: '{{linkUrl}}', color: 'primary' } },
      { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'payment-failed-insufficient-funds': {
    headerTitle: 'Payment Processing Alert',
    headerColor: '#F59E0B',
    subject: 'Payment Processing Failed - Insufficient Funds',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'warning-box', content: 'Your PayPal business account has insufficient funds to complete a payment.', properties: {} },
      { id: '3', type: 'amount-display', content: '{{amount}}', properties: { label: 'Required Amount', style: 'warning' } },
      { id: '4', type: 'numbered-list', content: 'Add funds to your PayPal business account\nWait for funds to become available\nContact admin to retry the payment', properties: {} },
      { id: '5', type: 'button', content: 'View Payment Details', properties: { url: '{{linkUrl}}', color: 'warning' } },
      { id: '6', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'deliverable-rejected': {
    headerTitle: 'Deliverable Rejected',
    headerColor: '#EF4444',
    subject: 'Your deliverable requires changes',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'error-box', content: 'Your deliverable for "{{offerTitle}}" has been rejected and requires changes.', properties: {} },
      { id: '3', type: 'text', content: 'Please review the feedback and resubmit your work.', properties: {} },
      { id: '4', type: 'button', content: 'View Feedback', properties: { url: '{{linkUrl}}', color: 'danger' } },
      { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
  'revision-requested': {
    headerTitle: 'Revision Requested',
    headerColor: '#F59E0B',
    subject: 'Revision requested for your submission',
    blocks: [
      { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
      { id: '2', type: 'warning-box', content: 'A revision has been requested for your submission on "{{offerTitle}}".', properties: {} },
      { id: '3', type: 'text', content: 'Please review the revision instructions and resubmit your work.', properties: {} },
      { id: '4', type: 'button', content: 'View Instructions', properties: { url: '{{linkUrl}}', color: 'warning' } },
      { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
    ],
  },
};

export default function AdminEmailTemplates() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showTypeSelectDialog, setShowTypeSelectDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState<string>("system");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [visualData, setVisualData] = useState<VisualEmailData>(createEmptyVisualData());

  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string; errorDetails?: string }>({
    open: false,
    title: "",
    description: ""
  });
  const [selectedTemplateType, setSelectedTemplateType] = useState<TemplateType | null>(null);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/admin/email-templates"],
    queryFn: async () => {
      const response = await fetch("/api/admin/email-templates", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch email templates");
      return response.json();
    },
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const { data: templateTypes = [] } = useQuery<TemplateType[]>({
    queryKey: ["/api/admin/email-templates/available-types"],
    queryFn: async () => {
      const response = await fetch("/api/admin/email-templates/available-types", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch template types");
      return response.json();
    },
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to create template");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({
        title: "Template Created",
        description: "The email template has been successfully created.",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to create template",
        errorDetails: error.message,
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/admin/email-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to update template");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({
        title: "Template Updated",
        description: "The email template has been successfully updated.",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to update template",
        errorDetails: error.message,
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/email-templates/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to delete template");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({
        title: "Template Deleted",
        description: "The email template has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to delete template",
        errorDetails: error.message,
      });
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/email-templates/${id}/duplicate`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to duplicate template");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({
        title: "Template Duplicated",
        description: "The email template has been duplicated. You can now edit the copy.",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to duplicate template",
        errorDetails: error.message,
      });
    },
  });

  const initializeDefaultsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/email-templates/initialize-defaults", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to initialize defaults");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({
        title: "Default Templates Created",
        description: `${data.created} default email templates have been created.`,
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to initialize default templates",
        errorDetails: error.message,
      });
    },
  });

  const handleCreate = () => {
    setShowTypeSelectDialog(true);
  };

  const handleSelectType = (templateType: TemplateType) => {
    setShowTypeSelectDialog(false);
    setEditingTemplate(null);
    setSelectedTemplateType(templateType);

    // Use pre-built template data if available
    const defaultData = DEFAULT_TEMPLATE_DATA[templateType.slug];
    if (defaultData) {
      setVisualData({
        blocks: defaultData.blocks.map((b, i) => ({ ...b, id: `block-${Date.now()}-${i}` })),
        headerTitle: defaultData.headerTitle,
        headerColor: defaultData.headerColor,
      });
      setSubject(defaultData.subject);
    } else {
      setVisualData(createEmptyVisualData());
      setSubject('');
    }

    setName(templateType.name);
    setSlug(templateType.slug);
    setCategory(templateType.category);
    setDescription(templateType.description);
    setIsActive(true);
    setShowDialog(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setName(template.name);
    setSlug(template.slug);
    setCategory(template.category);
    setSubject(template.subject);
    setDescription(template.description || "");
    setIsActive(template.isActive);

    // Load visual data if available, otherwise create from default or empty
    if (template.visualData) {
      setVisualData(template.visualData);
    } else {
      const defaultData = DEFAULT_TEMPLATE_DATA[template.slug];
      if (defaultData) {
        setVisualData({
          blocks: defaultData.blocks.map((b, i) => ({ ...b, id: `block-${Date.now()}-${i}` })),
          headerTitle: defaultData.headerTitle,
          headerColor: defaultData.headerColor,
        });
      } else {
        setVisualData(createEmptyVisualData());
      }
    }

    // Find matching template type for variable suggestions
    const matchingType = templateTypes.find(t => t.slug === template.slug);
    setSelectedTemplateType(matchingType || null);
    setShowDialog(true);
  };

  const handleDelete = (template: EmailTemplate) => {
    if (template.isSystem) {
      setErrorDialog({
        open: true,
        title: "Cannot Delete",
        description: "System templates cannot be deleted.",
      });
      return;
    }

    if (confirm("Are you sure you want to delete this email template? This action cannot be undone.")) {
      deleteTemplateMutation.mutate(template.id);
    }
  };

  const handleDuplicate = (template: EmailTemplate) => {
    duplicateTemplateMutation.mutate(template.id);
  };

  const handlePreview = (template?: EmailTemplate) => {
    let previewVisualData: VisualEmailData;
    let previewSubjectText: string;

    if (template) {
      previewVisualData = template.visualData || {
        blocks: [],
        headerTitle: 'Notification',
        headerColor: '#4F46E5',
      };
      previewSubjectText = template.subject;
    } else {
      previewVisualData = visualData;
      previewSubjectText = subject;
    }

    // Sample data for preview
    const sampleData: Record<string, string> = {
      userName: 'John Doe',
      companyName: 'Acme Corp',
      offerTitle: 'Summer Sale Promotion',
      amount: '$500.00',
      grossAmount: '$550.00',
      platformFee: '$22.00',
      processingFee: '$16.50',
      transactionId: 'TXN-12345',
      trackingLink: 'https://track.example.com/abc123',
      trackingCode: 'ABC123',
      linkUrl: 'https://app.example.com/dashboard',
      reviewRating: '5',
      reviewText: 'Great service and professional team!',
      messagePreview: 'Hello, I wanted to discuss the campaign details...',
      daysUntilExpiration: '7',
      otpCode: '123456',
      verificationUrl: 'https://app.example.com/verify/abc',
      resetUrl: 'https://app.example.com/reset/abc',
      applicationId: 'APP-12345',
      announcementTitle: 'New Features Available',
      announcementMessage: 'We have added exciting new features to improve your experience.',
    };

    // Generate HTML and replace variables
    let html = visualBlocksToHtml(previewVisualData);
    let subjectWithData = previewSubjectText;

    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(regex, value);
      subjectWithData = subjectWithData.replace(regex, value);
    });

    setPreviewSubject(subjectWithData);
    setPreviewHtml(html);
    setShowPreviewDialog(true);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setErrorDialog({
        open: true,
        title: "Missing Information",
        description: "Please enter a template name",
      });
      return;
    }

    if (!subject.trim()) {
      setErrorDialog({
        open: true,
        title: "Missing Information",
        description: "Please enter an email subject line",
      });
      return;
    }

    if (visualData.blocks.length === 0) {
      setErrorDialog({
        open: true,
        title: "Missing Information",
        description: "Please add at least one content block",
      });
      return;
    }

    // Generate HTML from visual data
    const htmlContent = visualBlocksToHtml(visualData);

    // Extract used variables
    const usedVariables: string[] = [];
    const variableRegex = /\{\{(\w+)\}\}/g;
    let match;
    const contentToCheck = subject + htmlContent;
    while ((match = variableRegex.exec(contentToCheck)) !== null) {
      if (!usedVariables.includes(match[1])) {
        usedVariables.push(match[1]);
      }
    }

    const data = {
      name,
      slug,
      category,
      subject,
      htmlContent,
      visualData,
      description: description || null,
      availableVariables: usedVariables,
      isActive,
    };

    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingTemplate(null);
    setName("");
    setSlug("");
    setCategory("system");
    setSubject("");
    setDescription("");
    setIsActive(true);
    setVisualData(createEmptyVisualData());
    setSelectedTemplateType(null);
  };

  if (isLoading || templatesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = categoryFilter === "all" || template.category === categoryFilter;
    const matchesSearch = !searchTerm ||
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.subject.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeCount = templates.filter(t => t.isActive).length;

  // Get available template types (not yet created)
  const createdSlugs = templates.map(t => t.slug);
  const availableTypes = templateTypes.filter(t => !createdSlugs.includes(t.slug));

  return (
    <div className="space-y-6">
      <TopNavBar />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground mt-2">
            Create and customize email notifications using the visual editor
          </p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button
              variant="outline"
              onClick={() => initializeDefaultsMutation.mutate()}
              disabled={initializeDefaultsMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${initializeDefaultsMutation.isPending ? 'animate-spin' : ''}`} />
              Load Default Templates
            </Button>
          )}
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Available Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{availableTypes.length}</div>
            <p className="text-xs text-muted-foreground">notification types without custom templates</p>
          </CardContent>
        </Card>
      </div>

      {/* Template List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              All Templates
            </CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    <div className="space-y-2">
                      <Mail className="h-8 w-8 mx-auto opacity-50" />
                      <p>No templates found.</p>
                      <p className="text-sm">Click "Load Default Templates" to create templates for all notification types.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {template.name}
                        {template.isSystem && (
                          <Badge variant="outline" className="text-xs">System</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate text-muted-foreground">
                      {template.subject}
                    </TableCell>
                    <TableCell>
                      {template.isActive ? (
                        <Badge className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => handlePreview(template)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Preview</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => handleDuplicate(template)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Duplicate</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(template)}
                              disabled={template.isSystem}
                            >
                              <Trash2 className={`h-4 w-4 ${template.isSystem ? 'text-muted-foreground' : 'text-destructive'}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{template.isSystem ? 'System templates cannot be deleted' : 'Delete'}</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Template Type Selection Dialog */}
      <Dialog open={showTypeSelectDialog} onOpenChange={setShowTypeSelectDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Notification Type</DialogTitle>
            <DialogDescription>
              Choose a notification type to create a custom email template for
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {/* Group by category */}
            {Object.entries(
              templateTypes.reduce((acc, t) => {
                if (!acc[t.category]) acc[t.category] = [];
                acc[t.category].push(t);
                return acc;
              }, {} as Record<string, TemplateType[]>)
            ).map(([cat, types]) => {
              const catInfo = CATEGORIES.find(c => c.value === cat);
              const CatIcon = catInfo?.icon || Mail;

              return (
                <div key={cat} className="mb-6">
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <CatIcon className="h-4 w-4" />
                    {catInfo?.label || cat}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {types.map(templateType => {
                      const exists = templates.some(t => t.slug === templateType.slug);
                      return (
                        <Card
                          key={templateType.type}
                          className={`cursor-pointer transition-colors ${exists ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'}`}
                          onClick={() => !exists && handleSelectType(templateType)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium">{templateType.name}</p>
                                <p className="text-sm text-muted-foreground line-clamp-2">{templateType.description}</p>
                                <p className="text-xs text-blue-600 mt-1">{templateType.variables.length} variables</p>
                              </div>
                              {exists ? (
                                <Badge variant="secondary" className="shrink-0">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Created
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="shrink-0">Available</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Email Template" : "Create Email Template"}
            </DialogTitle>
            <DialogDescription>
              Design your email using the visual editor - no coding required
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* Template Type Info */}
            {selectedTemplateType && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">{selectedTemplateType.name}</h4>
                    <p className="text-sm text-blue-700 mt-1">{selectedTemplateType.description}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input
                  placeholder="e.g., Application Approved"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <cat.icon className="h-4 w-4" />
                          {cat.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Subject Line */}
            <div className="space-y-2">
              <Label>Subject Line *</Label>
              <Input
                placeholder="e.g., Your application has been approved!"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use {'{{variableName}}'} for dynamic content, e.g., {'{{userName}}'}, {'{{offerTitle}}'}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Internal Description (optional)</Label>
              <Input
                placeholder="When is this template used? (internal note)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Separator />

            {/* Visual Email Builder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Email Content *</Label>
                <Button variant="outline" size="sm" onClick={() => handlePreview()}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Email
                </Button>
              </div>

              <VisualEmailBuilder
                value={visualData}
                onChange={setVisualData}
                templateVariables={selectedTemplateType?.variables.map(v => ({
                  name: v.name,
                  label: v.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                  description: v.description,
                  example: v.example,
                  icon: User,
                }))}
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div>
                <Label className="font-medium">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  When active, this template will be used for sending emails
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
            >
              {editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              This shows how the email will appear with sample data
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 flex-1 overflow-hidden">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium text-muted-foreground">Subject:</span>
              <span className="text-sm">{previewSubject}</span>
            </div>

            <div className="border rounded-lg overflow-hidden flex-1">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[500px]"
                title="Email Preview"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        errorDetails={errorDialog.errorDetails}
        variant="error"
      />
    </div>
  );
}
