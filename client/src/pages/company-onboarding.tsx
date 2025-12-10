import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useLocation } from "wouter";
import { queryClient } from "../lib/queryClient";
import { uploadToCloudinary } from "../lib/cloudinary-upload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import {
  Building2,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  X,
  FileText,
  Globe,
  Shield,
  CreditCard,
  Plus,
  Trash2,
  Eye,
  Download
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Company Information", description: "Tell us about your business" },
  { id: 2, title: "Contact Information", description: "How can we reach you" },
  { id: 3, title: "Verification", description: "Verify your business" },
  { id: 4, title: "Payment Method", description: "How you'll pay creators" },
  { id: 5, title: "Review", description: "Review and submit" },
];

const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-1000", label: "201-1000 employees" },
  { value: "1000+", label: "1000+ employees" },
];

const INDUSTRIES = [
  { value: "technology", label: "Technology" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "fashion", label: "Fashion & Apparel" },
  { value: "beauty", label: "Beauty & Cosmetics" },
  { value: "health", label: "Health & Wellness" },
  { value: "fitness", label: "Fitness" },
  { value: "food", label: "Food & Beverage" },
  { value: "travel", label: "Travel & Hospitality" },
  { value: "finance", label: "Finance & Insurance" },
  { value: "education", label: "Education" },
  { value: "entertainment", label: "Entertainment" },
  { value: "gaming", label: "Gaming" },
  { value: "home", label: "Home & Garden" },
  { value: "automotive", label: "Automotive" },
  { value: "other", label: "Other" },
];

type VerificationDocument = {
  id: string;
  documentUrl: string;
  documentName: string;
  documentType: string;
  fileSize: number | null;
};

export default function CompanyOnboarding() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  // Step 1: Company Information
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [industry, setIndustry] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [yearFounded, setYearFounded] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [description, setDescription] = useState("");

  // Step 2: Contact Information
  const [contactName, setContactName] = useState("");
  const [contactJobTitle, setContactJobTitle] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");

  // Step 3: Verification
  const [verificationDocuments, setVerificationDocuments] = useState<VerificationDocument[]>([]);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");

  // Step 4: Payment Method
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [payoutEmail, setPayoutEmail] = useState("");
  const [bankRoutingNumber, setBankRoutingNumber] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [cryptoWalletAddress, setCryptoWalletAddress] = useState("");
  const [cryptoNetwork, setCryptoNetwork] = useState("");

  // Load user data
  useEffect(() => {
    if (user) {
      setContactName(user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "");
    }
  }, [user]);

  // Load existing verification documents so uploads are preserved across sessions
  useEffect(() => {
    const loadVerificationDocuments = async () => {
      try {
        const response = await fetch("/api/company/verification-documents", {
          credentials: "include",
        });

        if (!response.ok) return;

        const documents = await response.json();
        setVerificationDocuments(documents);
      } catch (error) {
        console.error("Failed to load verification documents:", error);
      }
    };

    loadVerificationDocuments();
  }, []);

  // Check if user should be here
  useEffect(() => {
    if (user && user.role !== 'company') {
      setLocation('/browse');
    }
  }, [user, setLocation]);

  const calculateProgress = () => {
    return ((currentStep - 1) / (STEPS.length - 1)) * 100;
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const isImage = imageExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isImage) {
      setErrorDialog({
        title: "Invalid File Type",
        message: "Please upload an image file (JPG, PNG, GIF, WebP)",
      });
      return;
    }

    if (file.size > 5242880) {
      setErrorDialog({
        title: "File Too Large",
        message: "Image file must be less than 5MB",
      });
      return;
    }

    setIsUploadingLogo(true);

    try {
      // Use user ID for organized folder structure
      const folder = user?.id
        ? `company-logos/${user.id}`
        : "company-logos";

      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folder,
          resourceType: "image",
          contentType: file.type,
          fileName: file.name,
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const uploadData = await uploadResponse.json();

      const uploadResult = await uploadToCloudinary(uploadData, file);

      if (!uploadResult?.secure_url) {
        throw new Error("Failed to upload file to storage");
      }

      // Save full Cloudinary URL like creator profile does
      const objectPath = uploadResult.secure_url;
      setLogoUrl(objectPath);

      toast({
        title: "Success!",
        description: "Logo uploaded successfully.",
      });
    } catch (error) {
      console.error("Logo upload error:", error);
      setErrorDialog({
        title: "Upload Failed",
        message: "Failed to upload logo. Please try again.",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const isValid = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isValid) {
      setErrorDialog({
        title: "Invalid File Type",
        message: "Please upload a PDF or image file",
      });
      return;
    }

    if (file.size > 10485760) { // 10MB
      setErrorDialog({
        title: "File Too Large",
        message: "Document must be less than 10MB",
      });
      return;
    }

    // Check max documents limit
    if (verificationDocuments.length >= 5) {
      setErrorDialog({
        title: "Maximum Documents Reached",
        message: "You can upload a maximum of 5 verification documents",
      });
      return;
    }

    setIsUploadingDocument(true);

    try {
      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folder: user?.id ? `verification-documents/${user.id}` : "verification-documents",
          resourceType: file.type === 'application/pdf' ? 'raw' : 'image',
          contentType: file.type, // Pass actual file content type
          fileName: file.name // Pass original filename to preserve extension
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const uploadData = await uploadResponse.json();

      const uploadResult = await uploadToCloudinary(uploadData, file);

      if (!uploadResult?.secure_url) {
        throw new Error("Failed to upload file to storage");
      }

      // Save full Cloudinary URL like creator profile does
      const uploadedUrl = uploadResult.secure_url;

      // Determine document type
      const documentType = file.type === 'application/pdf' ? 'pdf' : 'image';

      // Persist the document metadata so the path is available to the API
      const saveResponse = await fetch("/api/company/verification-documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          documentUrl: uploadedUrl,
          documentName: file.name,
          documentType,
          fileSize: file.size,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error("Failed to save verification document");
      }

      const { document } = await saveResponse.json();

      setVerificationDocuments(prev => [...prev, document]);

      toast({
        title: "Success!",
        description: "Verification document uploaded successfully.",
      });
    } catch (error) {
      console.error("Document upload error:", error);
      setErrorDialog({
        title: "Upload Failed",
        message: "Failed to upload document. Please try again.",
      });
    } finally {
      setIsUploadingDocument(false);
      // Reset the input so the same file can be uploaded again if needed
      event.target.value = '';
    }
  };

  const handleRemoveDocument = async (documentId: string) => {
    try {
      const document = verificationDocuments.find((doc) => doc.id === documentId);

      // Only attempt server deletion for persisted documents
      if (document && !document.id.startsWith("temp-")) {
        await fetch(`/api/company/verification-documents/${documentId}`, {
          method: "DELETE",
          credentials: "include",
        });
      }
    } catch (error) {
      console.error("Failed to delete verification document:", error);
    } finally {
      setVerificationDocuments(prev => prev.filter(doc => doc.id !== documentId));
    }
  };

  // Helper to extract file path from GCS or Cloudinary URLs
  const extractFilePathFromUrl = (documentUrl: string): string => {
    const url = new URL(documentUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Handle GCS URLs: https://storage.googleapis.com/{bucket}/{path}
    if (url.hostname === 'storage.googleapis.com' || url.hostname.endsWith('.storage.googleapis.com')) {
      // Skip bucket name (first part), return rest as file path
      return pathParts.slice(1).join('/');
    }

    // Handle Cloudinary URLs: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{public_id}
    if (url.hostname.includes('cloudinary.com')) {
      const uploadIndex = pathParts.findIndex(part => part === 'upload');
      if (uploadIndex === -1) {
        throw new Error('Invalid Cloudinary URL format');
      }
      // Skip 'upload' and version number (v123456), get the rest as public_id
      return pathParts.slice(uploadIndex + 2).join('/');
    }

    throw new Error('Unknown storage URL format');
  };

  const handleViewDocument = async (documentUrl: string) => {
    try {
      const filePath = extractFilePathFromUrl(documentUrl);

      // Fetch signed URL from the API
      const response = await fetch(`/api/get-signed-url/${filePath}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to get document access');
      }

      const data = await response.json();
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error viewing document:', error);
      toast({
        title: "Error",
        description: "Failed to view document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadDocument = async (documentUrl: string, documentName: string) => {
    try {
      const filePath = extractFilePathFromUrl(documentUrl);

      // Fetch signed URL with download flag from the API
      const response = await fetch(`/api/get-signed-url/${filePath}?download=true&name=${encodeURIComponent(documentName)}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const data = await response.json();

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = data.url;
      link.download = documentName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Error",
        description: "Failed to download document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!legalName.trim()) {
          setErrorDialog({
            title: "Required Field",
            message: "Legal company name is required",
          });
          return false;
        }
        if (!websiteUrl.trim()) {
          setErrorDialog({
            title: "Required Field",
            message: "Company website URL is required",
          });
          return false;
        }
        if (!logoUrl) {
          setErrorDialog({
            title: "Required Field",
            message: "Company logo is required",
          });
          return false;
        }
        if (!description.trim() || description.trim().length < 50) {
          setErrorDialog({
            title: "Description Too Short",
            message: "Company description must be at least 50 characters",
          });
          return false;
        }
        if (description.trim().split(/\s+/).length > 1000) {
          setErrorDialog({
            title: "Description Too Long",
            message: "Company description must not exceed 1000 words",
          });
          return false;
        }
        return true;

      case 2:
        if (!contactName.trim()) {
          setErrorDialog({
            title: "Required Field",
            message: "Contact name is required",
          });
          return false;
        }
        if (!phoneNumber.trim()) {
          setErrorDialog({
            title: "Required Field",
            message: "Business phone number is required",
          });
          return false;
        }
        if (!businessAddress.trim()) {
          setErrorDialog({
            title: "Required Field",
            message: "Business address is required",
          });
          return false;
        }
        return true;

      case 3:
        if (verificationDocuments.length === 0) {
          setErrorDialog({
            title: "Verification Required",
            message: "Please upload at least one verification document (business registration certificate or Tax ID document)",
          });
          return false;
        }
        return true;

      case 4:
        if (!paymentMethod) {
          setErrorDialog({
            title: "Payment Method",
            message: "Please select how you'll pay creators or choose to set it up later.",
          });
          return false;
        }

        if (paymentMethod === "setup_later") {
          return true;
        }

        if (paymentMethod === "etransfer" && !payoutEmail) {
          setErrorDialog({
            title: "Payment details required",
            message: "Please add an e-transfer email to continue.",
          });
          return false;
        }

        if (paymentMethod === "wire" && (!bankRoutingNumber || !bankAccountNumber)) {
          setErrorDialog({
            title: "Payment details required",
            message: "Please add your bank routing and account number to continue.",
          });
          return false;
        }

        if (paymentMethod === "paypal" && !paypalEmail) {
          setErrorDialog({
            title: "Payment details required",
            message: "Please add your PayPal email to continue.",
          });
          return false;
        }

        if (paymentMethod === "crypto" && (!cryptoWalletAddress || !cryptoNetwork)) {
          setErrorDialog({
            title: "Payment details required",
            message: "Please add your wallet address and network to continue.",
          });
          return false;
        }

        return true;

      default:
        return true;
    }
  };

  const handleSetUpLater = () => {
    setPaymentMethod("setup_later");
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    setIsSubmitting(true);

    try {
      // Use the first document URL for backward compatibility with existing schema
      const firstDocumentUrl = verificationDocuments.length > 0 ? verificationDocuments[0].documentUrl : null;

      const payload = {
        legalName: legalName.trim(),
        tradeName: tradeName.trim() || null,
        industry: industry || null,
        websiteUrl: websiteUrl.trim(),
        companySize: companySize || null,
        yearFounded: yearFounded ? parseInt(yearFounded) : null,
        logoUrl,
        description: description.trim(),
        contactName: contactName.trim(),
        contactJobTitle: contactJobTitle.trim() || null,
        phoneNumber: phoneNumber.trim(),
        businessAddress: businessAddress.trim(),
        verificationDocumentUrl: firstDocumentUrl,
        linkedinUrl: linkedinUrl.trim() || null,
        twitterUrl: twitterUrl.trim() || null,
        facebookUrl: facebookUrl.trim() || null,
        instagramUrl: instagramUrl.trim() || null,
      };

      const response = await fetch("/api/company/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit onboarding");
      }

      // Persist any documents that haven't been saved yet (should be temporary IDs only)
      for (const doc of verificationDocuments.filter(doc => doc.id.startsWith("temp-"))) {
        try {
          await fetch("/api/company/verification-documents", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              documentUrl: doc.documentUrl,
              documentName: doc.documentName,
              documentType: doc.documentType,
              fileSize: doc.fileSize,
            }),
          });
        } catch (docError) {
          console.error("Error saving verification document:", docError);
          // Continue with other documents even if one fails
        }
      }

      // Save payment method if user didn't choose to set it up later
      if (paymentMethod && paymentMethod !== "setup_later") {
        const paymentPayload: any = {
          payoutMethod: paymentMethod,
        };

        if (paymentMethod === "etransfer") {
          paymentPayload.payoutEmail = payoutEmail;
        } else if (paymentMethod === "wire") {
          paymentPayload.bankRoutingNumber = bankRoutingNumber;
          paymentPayload.bankAccountNumber = bankAccountNumber;
        } else if (paymentMethod === "paypal") {
          paymentPayload.paypalEmail = paypalEmail;
        } else if (paymentMethod === "crypto") {
          paymentPayload.cryptoWalletAddress = cryptoWalletAddress;
          paymentPayload.cryptoNetwork = cryptoNetwork;
        }

        try {
          const paymentResponse = await fetch("/api/payment-settings", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(paymentPayload),
          });

          if (!paymentResponse.ok) {
            const error = await paymentResponse.json();
            throw new Error(error.error || "Failed to save payment method");
          }

          // Invalidate payment settings query to refresh the data
          await queryClient.invalidateQueries({ queryKey: ["/api/payment-settings"] });
        } catch (paymentError) {
          console.error("Error saving payment method:", paymentError);
          // Continue with onboarding even if payment method fails
          // User can set it up later in Payment Settings
        }
      }

      toast({
        title: "Success!",
        description: "Your profile has been submitted for review. You'll be notified once approved.",
      });

      // Refresh user data and redirect
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setTimeout(() => {
        setLocation("/company/dashboard");
      }, 1500);
    } catch (error: any) {
      console.error("Onboarding error:", error);
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to submit onboarding. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="legalName">
                Legal Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="legalName"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Official registered company name"
                required
              />
              <p className="text-xs text-muted-foreground">
                Your official registered business name
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tradeName">Trade/DBA Name</Label>
              <Input
                id="tradeName"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="Doing Business As (if different)"
              />
              <p className="text-xs text-muted-foreground">
                The name you operate under (if different from legal name)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">
                Industry/Primary Niche <span className="text-red-500">*</span>
              </Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select your industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map(ind => (
                    <SelectItem key={ind.value} value={ind.value}>
                      {ind.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="websiteUrl">
                Company Website URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="websiteUrl"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourcompany.com"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companySize">Company Size</Label>
                <Select value={companySize} onValueChange={setCompanySize}>
                  <SelectTrigger id="companySize">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZES.map(size => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="yearFounded">Year Founded</Label>
                <Input
                  id="yearFounded"
                  type="number"
                  min="1800"
                  max={new Date().getFullYear()}
                  value={yearFounded}
                  onChange={(e) => setYearFounded(e.target.value)}
                  placeholder={new Date().getFullYear().toString()}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Company Logo <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Square format, minimum 512x512px recommended
              </p>
              {logoUrl ? (
                <div className="relative inline-block">
                  <div className="flex items-center gap-4 p-4 border rounded-lg">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={logoUrl} alt="Company logo" />
                      <AvatarFallback className="text-2xl">
                        {legalName?.[0] || 'C'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">Logo Uploaded</p>
                      <p className="text-sm text-muted-foreground">This will appear on all your offers</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2"
                    onClick={() => setLogoUrl("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label
                    htmlFor="logo-upload"
                    className={`border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer block ${
                      isUploadingLogo ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {isUploadingLogo ? (
                        <>
                          <Upload className="h-8 w-8 text-blue-600 animate-pulse" />
                          <div className="text-sm font-medium text-blue-600">
                            Uploading Logo...
                          </div>
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-primary" />
                          <div className="text-sm font-medium">
                            Click to upload company logo
                          </div>
                          <div className="text-xs text-muted-foreground">
                            JPG, PNG, GIF, WebP (max 5MB)
                          </div>
                        </>
                      )}
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Company Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell creators about your company, products, and what makes you unique... (minimum 50 characters)"
                className="min-h-32"
                required
              />
              <p className="text-xs text-muted-foreground">
                {description.trim().split(/\s+/).filter(w => w).length}/1000 words (minimum 50 characters)
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Primary Contact Information</AlertTitle>
              <AlertDescription>
                This is the person we'll contact regarding your account and offers
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="contactName">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactJobTitle">Job Title</Label>
              <Input
                id="contactJobTitle"
                value={contactJobTitle}
                onChange={(e) => setContactJobTitle(e.target.value)}
                placeholder="Marketing Director, CEO, etc."
              />
            </div>

            <div className="space-y-2">
              <Label>Business Email <span className="text-red-500">*</span></Label>
              <Input
                type="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Using your account email: {user?.email}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">
                Business Phone Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 (555) 000-0000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessAddress">
                Business Address <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="businessAddress"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                placeholder="Full business address including street, city, state, ZIP, and country"
                className="min-h-24"
                required
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Business Verification</AlertTitle>
              <AlertDescription>
                We need to verify your business before you can create offers
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>
                    Verification Documents <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload one or more of the following (max 5 documents):
                  </p>
                </div>
                <Badge variant="outline">
                  {verificationDocuments.length}/5
                </Badge>
              </div>

              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                <li>Business registration certificate</li>
                <li>EIN/Tax ID document</li>
                <li>Certificate of incorporation</li>
                <li>Business license</li>
                <li>Other supporting documents</li>
              </ul>

              {/* Uploaded Documents List */}
              {verificationDocuments.length > 0 && (
                <div className="space-y-2">
                  {verificationDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200"
                    >
                      <FileText className="h-6 w-6 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-green-900 dark:text-green-100 truncate">
                          {doc.documentName}
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-300">
                          {doc.documentType.toUpperCase()} • {formatFileSize(doc.fileSize)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleViewDocument(doc.documentUrl)}
                          title="View document"
                        >
                          <Eye className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownloadDocument(doc.documentUrl, doc.documentName)}
                          title="Download document"
                        >
                          <Download className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRemoveDocument(doc.id)}
                          title="Delete document"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Area */}
              {verificationDocuments.length < 5 && (
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleDocumentUpload}
                    disabled={isUploadingDocument}
                    className="hidden"
                    id="document-upload"
                  />
                  <label
                    htmlFor="document-upload"
                    className={`border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer block ${
                      isUploadingDocument ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {isUploadingDocument ? (
                        <>
                          <Upload className="h-6 w-6 text-blue-600 animate-pulse" />
                          <div className="text-sm font-medium text-blue-600">
                            Uploading Document...
                          </div>
                        </>
                      ) : (
                        <>
                          <Plus className="h-6 w-6 text-primary" />
                          <div className="text-sm font-medium">
                            {verificationDocuments.length === 0
                              ? "Click to upload verification document"
                              : "Add another document"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            PDF, JPG, PNG (max 10MB per file)
                          </div>
                        </>
                      )}
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base font-semibold">Social Media Profiles (Optional)</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Adding social media profiles helps build trust with creators
              </p>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="linkedinUrl">LinkedIn Company Page</Label>
                  <Input
                    id="linkedinUrl"
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/company/yourcompany"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitterUrl">Twitter/X Profile</Label>
                  <Input
                    id="twitterUrl"
                    type="url"
                    value={twitterUrl}
                    onChange={(e) => setTwitterUrl(e.target.value)}
                    placeholder="https://twitter.com/yourcompany"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="facebookUrl">Facebook Page</Label>
                  <Input
                    id="facebookUrl"
                    type="url"
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    placeholder="https://facebook.com/yourcompany"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instagramUrl">Instagram Profile</Label>
                  <Input
                    id="instagramUrl"
                    type="url"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    placeholder="https://instagram.com/yourcompany"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="rounded-lg border p-4 bg-muted/30">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-blue-100 p-2">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold">Choose how you'll pay creators</h3>
                  <p className="text-sm text-muted-foreground">
                    This funding method is used when you release payments to creators for their campaigns.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {["etransfer", "wire", "paypal", "crypto"].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`rounded-lg border p-4 text-left transition hover:border-primary ${
                    paymentMethod === method ? "border-primary ring-2 ring-primary/40" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold capitalize">{method === "wire" ? "Wire / ACH" : method}</div>
                    {paymentMethod === method && <Badge>Selected</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {method === "etransfer" && "Send creator payouts via business e-transfer."}
                    {method === "wire" && "Use your bank account for ACH or wire transfers."}
                    {method === "paypal" && "Fund payouts directly from your PayPal account."}
                    {method === "crypto" && "Send payouts using your preferred crypto network."}
                  </p>
                </button>
              ))}
            </div>

            {paymentMethod && paymentMethod !== "setup_later" && (
              <div className="space-y-4">
                {paymentMethod === "etransfer" && (
                  <div className="space-y-2">
                    <Label htmlFor="payoutEmail">Payout Email</Label>
                    <Input
                      id="payoutEmail"
                      type="email"
                      placeholder="accounts@company.com"
                      value={payoutEmail}
                      onChange={(e) => setPayoutEmail(e.target.value)}
                    />
                  </div>
                )}

                {paymentMethod === "wire" && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="routingNumber">Bank Routing Number</Label>
                      <Input
                        id="routingNumber"
                        placeholder="123456789"
                        value={bankRoutingNumber}
                        onChange={(e) => setBankRoutingNumber(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accountNumber">Bank Account Number</Label>
                      <Input
                        id="accountNumber"
                        placeholder="000123456789"
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === "paypal" && (
                  <div className="space-y-2">
                    <Label htmlFor="paypalEmail">PayPal Email</Label>
                    <Input
                      id="paypalEmail"
                      type="email"
                      placeholder="billing@company.com"
                      value={paypalEmail}
                      onChange={(e) => setPaypalEmail(e.target.value)}
                    />
                  </div>
                )}

                {paymentMethod === "crypto" && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="walletAddress">Wallet Address</Label>
                      <Input
                        id="walletAddress"
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
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/20 p-4">
              <div>
                <p className="font-semibold">Prefer to decide later?</p>
                <p className="text-sm text-muted-foreground">You can continue onboarding and finish setup in Payment Settings.</p>
              </div>
              <Button variant="outline" onClick={handleSetUpLater}>
                Set up later
              </Button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Ready to Submit</AlertTitle>
              <AlertDescription>
                Review your information before submitting for approval
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company Information
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Legal Name:</dt>
                  <dd className="font-medium">{legalName}</dd>

                  {tradeName && (
                    <>
                      <dt className="text-muted-foreground">Trade Name:</dt>
                      <dd className="font-medium">{tradeName}</dd>
                    </>
                  )}

                  <dt className="text-muted-foreground">Industry:</dt>
                  <dd className="font-medium capitalize">{industry || "Not specified"}</dd>

                  <dt className="text-muted-foreground">Website:</dt>
                  <dd className="font-medium truncate">{websiteUrl}</dd>

                  {companySize && (
                    <>
                      <dt className="text-muted-foreground">Company Size:</dt>
                      <dd className="font-medium">{COMPANY_SIZES.find(s => s.value === companySize)?.label}</dd>
                    </>
                  )}

                  {yearFounded && (
                    <>
                      <dt className="text-muted-foreground">Founded:</dt>
                      <dd className="font-medium">{yearFounded}</dd>
                    </>
                  )}
                </dl>

                {logoUrl && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Logo:</p>
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={logoUrl} alt="Company logo" />
                      <AvatarFallback>{legalName?.[0]}</AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Contact Information</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Contact Name:</dt>
                  <dd className="font-medium">{contactName}</dd>

                  {contactJobTitle && (
                    <>
                      <dt className="text-muted-foreground">Job Title:</dt>
                      <dd className="font-medium">{contactJobTitle}</dd>
                    </>
                  )}

                  <dt className="text-muted-foreground">Email:</dt>
                  <dd className="font-medium">{user?.email}</dd>

                  <dt className="text-muted-foreground">Phone:</dt>
                  <dd className="font-medium">{phoneNumber}</dd>

                  <dt className="text-muted-foreground col-span-2">Address:</dt>
                  <dd className="font-medium col-span-2">{businessAddress}</dd>
                </dl>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Verification
                </h3>
                <div className="flex items-center gap-2 text-sm mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>{verificationDocuments.length} verification document{verificationDocuments.length !== 1 ? 's' : ''} uploaded</span>
                </div>
                {verificationDocuments.length > 0 && (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {verificationDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        <span className="truncate">{doc.documentName}</span>
                      </div>
                    ))}
                  </div>
                )}
                {(linkedinUrl || twitterUrl || facebookUrl || instagramUrl) && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm font-medium mb-2">Social Media:</p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {linkedinUrl && <div>• LinkedIn</div>}
                      {twitterUrl && <div>• Twitter/X</div>}
                      {facebookUrl && <div>• Facebook</div>}
                      {instagramUrl && <div>• Instagram</div>}
                    </div>
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Method
                </h3>
                {paymentMethod === "setup_later" || !paymentMethod ? (
                  <p className="text-sm text-muted-foreground">
                    You'll finish setting up your payment method later in Payment Settings.
                  </p>
                ) : (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Method:</dt>
                    <dd className="font-medium capitalize">{paymentMethod === "wire" ? "Wire / ACH" : paymentMethod}</dd>

                    {paymentMethod === "etransfer" && (
                      <>
                        <dt className="text-muted-foreground">Payout Email:</dt>
                        <dd className="font-medium">{payoutEmail}</dd>
                      </>
                    )}

                    {paymentMethod === "wire" && (
                      <>
                        <dt className="text-muted-foreground">Routing Number:</dt>
                        <dd className="font-medium">{bankRoutingNumber || "-"}</dd>
                        <dt className="text-muted-foreground">Account Number:</dt>
                        <dd className="font-medium">{bankAccountNumber ? `****${bankAccountNumber.slice(-4)}` : "-"}</dd>
                      </>
                    )}

                    {paymentMethod === "paypal" && (
                      <>
                        <dt className="text-muted-foreground">PayPal:</dt>
                        <dd className="font-medium">{paypalEmail}</dd>
                      </>
                    )}

                    {paymentMethod === "crypto" && (
                      <>
                        <dt className="text-muted-foreground">Wallet:</dt>
                        <dd className="font-medium">{cryptoWalletAddress}</dd>
                        <dt className="text-muted-foreground">Network:</dt>
                        <dd className="font-medium capitalize">{cryptoNetwork}</dd>
                      </>
                    )}
                  </dl>
                )}
              </div>
            </div>

            <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-900 dark:text-blue-100">What happens next?</AlertTitle>
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                The user should immediately receive a confirmation email right after the account is activated,
                with details on the approval timeline and when their account will be activated.
              </AlertDescription>
            </Alert>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src="/logo.png" alt="AffiliateXchange Logo" className="h-10 w-10 rounded-md object-cover" />
            <span className="text-2xl font-bold">AffiliateXchange</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Company Registration</h1>
          <p className="text-muted-foreground">Complete your profile to start creating offers</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex-1 text-center ${index < STEPS.length - 1 ? 'mr-2' : ''}`}
              >
                <div
                  className={`text-xs font-medium mb-1 ${
                    currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {step.title}
                </div>
              </div>
            ))}
          </div>
          <Progress value={calculateProgress()} className="h-2" />
          <div className="text-center mt-2 text-sm text-muted-foreground">
            Step {currentStep} of {STEPS.length}
          </div>
        </div>

        {/* Content Card */}
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
            <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderStepContent()}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1 || isSubmitting}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              {currentStep < STEPS.length ? (
                <Button onClick={handleNext}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? (
                    "Submitting..."
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Submit for Approval
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Need help? Contact us at support@affiliatexchange.com</p>
        </div>
      </div>

      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title || "Error"}
        description={errorDialog?.message || "An error occurred"}
      />
    </div>
  );
}