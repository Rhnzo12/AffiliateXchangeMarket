import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Separator } from "../components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Upload, Building2, X, ChevronsUpDown, Download, Trash2, Shield, AlertTriangle, Video, Globe, FileText } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import { TopNavBar } from "../components/TopNavBar";

export default function Settings() {
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  
  // Creator profile states
  const [bio, setBio] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [youtubeFollowers, setYoutubeFollowers] = useState("");
  const [tiktokFollowers, setTiktokFollowers] = useState("");
  const [instagramFollowers, setInstagramFollowers] = useState("");
  
  // Company profile states
  const [tradeName, setTradeName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactJobTitle, setContactJobTitle] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [yearFounded, setYearFounded] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [companyInstagramUrl, setCompanyInstagramUrl] = useState("");
  const [verificationDocumentUrl, setVerificationDocumentUrl] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false);

  // Account info states
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Email change states
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [emailChangePassword, setEmailChangePassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  const requiresPasswordForEmailChange = (!user?.googleId || Boolean(user?.password));

  // Dialog state for video platform warning
  const [showVideoPlatformDialog, setShowVideoPlatformDialog] = useState(false);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Privacy & Data states
  const [isExportingData, setIsExportingData] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showActiveItemsDialog, setShowActiveItemsDialog] = useState(false);
  const [activeItemsDetails, setActiveItemsDetails] = useState<any>(null);

  const { data: profile } = useQuery<any>({
    queryKey: ["/api/profile"],
    enabled: isAuthenticated,
  });

  // Fetch niches from API
  const { data: niches = [], isLoading: nichesLoading } = useQuery<Array<{ id: string; name: string; description: string | null; isActive: boolean }>>({
    queryKey: ["/api/niches"],
  });

  // Convert niches to the format expected by the component
  const AVAILABLE_NICHES = niches.map(niche => ({
    value: niche.name.toLowerCase().replace(/\s+/g, '_'),
    label: niche.name
  }));

  // Load saved form data from localStorage on mount
  useEffect(() => {
    const savedFormData = localStorage.getItem('settings-form-data');
    if (savedFormData) {
      try {
        const data = JSON.parse(savedFormData);
        // Restore creator profile fields
        if (data.bio !== undefined) setBio(data.bio);
        if (data.profileImageUrl !== undefined) setProfileImageUrl(data.profileImageUrl);
        if (data.selectedNiches !== undefined) setSelectedNiches(data.selectedNiches);
        if (data.youtubeUrl !== undefined) setYoutubeUrl(data.youtubeUrl);
        if (data.tiktokUrl !== undefined) setTiktokUrl(data.tiktokUrl);
        if (data.instagramUrl !== undefined) setInstagramUrl(data.instagramUrl);
        if (data.youtubeFollowers !== undefined) setYoutubeFollowers(data.youtubeFollowers);
        if (data.tiktokFollowers !== undefined) setTiktokFollowers(data.tiktokFollowers);
        if (data.instagramFollowers !== undefined) setInstagramFollowers(data.instagramFollowers);
        // Restore company profile fields
        if (data.tradeName !== undefined) setTradeName(data.tradeName);
        if (data.legalName !== undefined) setLegalName(data.legalName);
        if (data.logoUrl !== undefined) setLogoUrl(data.logoUrl);
        if (data.industry !== undefined) setIndustry(data.industry);
        if (data.websiteUrl !== undefined) setWebsiteUrl(data.websiteUrl);
        if (data.companyDescription !== undefined) setCompanyDescription(data.companyDescription);
        if (data.contactName !== undefined) setContactName(data.contactName);
        if (data.contactJobTitle !== undefined) setContactJobTitle(data.contactJobTitle);
        if (data.phoneNumber !== undefined) setPhoneNumber(data.phoneNumber);
        if (data.businessAddress !== undefined) setBusinessAddress(data.businessAddress);
        if (data.companySize !== undefined) setCompanySize(data.companySize);
        if (data.yearFounded !== undefined) setYearFounded(data.yearFounded);
        if (data.linkedinUrl !== undefined) setLinkedinUrl(data.linkedinUrl);
        if (data.twitterUrl !== undefined) setTwitterUrl(data.twitterUrl);
        if (data.facebookUrl !== undefined) setFacebookUrl(data.facebookUrl);
        if (data.companyInstagramUrl !== undefined) setCompanyInstagramUrl(data.companyInstagramUrl);
        if (data.verificationDocumentUrl !== undefined) setVerificationDocumentUrl(data.verificationDocumentUrl);
      } catch (error) {
        console.error('[Settings] Error loading saved form data:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      // Load user account data
      setUsername(user.username || "");
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      console.log("[Settings] Profile loaded:", profile);

      // Load creator profile data
      if (user?.role === 'creator') {
        setBio(profile.bio || "");
        setProfileImageUrl(profile.profileImageUrl || "");
        setSelectedNiches(profile.niches || []);
        setYoutubeUrl(profile.youtubeUrl || "");
        setTiktokUrl(profile.tiktokUrl || "");
        setInstagramUrl(profile.instagramUrl || "");
        setYoutubeFollowers(profile.youtubeFollowers?.toString() || "");
        setTiktokFollowers(profile.tiktokFollowers?.toString() || "");
        setInstagramFollowers(profile.instagramFollowers?.toString() || "");
      }

      // Load company profile data
      if (user?.role === 'company') {
        setTradeName(profile.tradeName || "");
        setLegalName(profile.legalName || "");
        setLogoUrl(profile.logoUrl || "");
        setIndustry(profile.industry || "");
        setWebsiteUrl(profile.websiteUrl || "");
        setCompanyDescription(profile.description || "");
        setContactName(profile.contactName || "");
        setContactJobTitle(profile.contactJobTitle || "");
        setPhoneNumber(profile.phoneNumber || "");
        setBusinessAddress(profile.businessAddress || "");
        setCompanySize(profile.companySize || "");
        setYearFounded(profile.yearFounded?.toString() || "");
        setLinkedinUrl(profile.linkedinUrl || "");
        setTwitterUrl(profile.twitterUrl || "");
        setFacebookUrl(profile.facebookUrl || "");
        setCompanyInstagramUrl(profile.instagramUrl || "");
        setVerificationDocumentUrl(profile.verificationDocumentUrl || "");
      }
    }
  }, [profile, user?.role]);

  // Save form state to localStorage whenever fields change
  useEffect(() => {
    // Only save if user is authenticated and we have at least some data
    if (!isAuthenticated) return;

    const formData = {
      // Creator profile fields
      bio,
      profileImageUrl,
      selectedNiches,
      youtubeUrl,
      tiktokUrl,
      instagramUrl,
      youtubeFollowers,
      tiktokFollowers,
      instagramFollowers,
      // Company profile fields
      tradeName,
      legalName,
      logoUrl,
      industry,
      websiteUrl,
      companyDescription,
      contactName,
      contactJobTitle,
      phoneNumber,
      businessAddress,
      companySize,
      yearFounded,
      linkedinUrl,
      twitterUrl,
      facebookUrl,
      companyInstagramUrl,
      verificationDocumentUrl,
    };

    localStorage.setItem('settings-form-data', JSON.stringify(formData));
  }, [
    isAuthenticated, bio, profileImageUrl, selectedNiches, youtubeUrl, tiktokUrl, instagramUrl,
    youtubeFollowers, tiktokFollowers, instagramFollowers, tradeName, legalName,
    logoUrl, industry, websiteUrl, companyDescription, contactName, contactJobTitle,
    phoneNumber, businessAddress, companySize, yearFounded, linkedinUrl, twitterUrl,
    facebookUrl, companyInstagramUrl, verificationDocumentUrl
  ]);

  // Handle logo upload
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const isImage = imageExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isImage) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file (JPG, PNG, GIF, WebP)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5242880) {
      toast({
        title: "File Too Large",
        description: "Image file must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingLogo(true);

    try {
      // Use company profile ID for organized folder structure
      const folder = profile?.id
        ? `company-logos/${profile.id}`
        : user?.id
        ? `company-logos/${user.id}`
        : "company-logos";

      // Get upload URL from backend
      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder, resourceType: "image" }),
      });
      
      if (!uploadResponse.ok) {
        throw new Error("Failed to get upload URL");
      }
      
      const uploadData = await uploadResponse.json();

      // Upload file to Cloudinary
      const formData = new FormData();
      formData.append('file', file);

      if (uploadData.uploadPreset) {
        formData.append('upload_preset', uploadData.uploadPreset);
      } else if (uploadData.signature) {
        formData.append('signature', uploadData.signature);
        formData.append('timestamp', uploadData.timestamp.toString());
        formData.append('api_key', uploadData.apiKey);
      }

      if (uploadData.folder) {
        formData.append('folder', uploadData.folder);
      }

      const uploadResult = await fetch(uploadData.uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!uploadResult.ok) {
        throw new Error("Failed to upload file");
      }

      const cloudinaryResponse = await uploadResult.json();
      const uploadedUrl = cloudinaryResponse.secure_url;
      
      // Set the logo URL
      setLogoUrl(uploadedUrl);
      
      toast({
        title: "Success!",
        description: "Logo uploaded successfully. Don't forget to save your changes.",
      });
    } catch (error) {
      console.error("Logo upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleProfileImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const isImage = imageExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isImage) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file (JPG, PNG, GIF, WebP)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5242880) {
      toast({
        title: "File Too Large",
        description: "Image file must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingProfileImage(true);

    try {
      const folder = user?.id
        ? `creatorprofile/${user.id}`
        : "creatorprofile";

      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder, resourceType: "image" }),
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const uploadData = await uploadResponse.json();

      const formData = new FormData();
      formData.append('file', file);

      if (uploadData.uploadPreset) {
        formData.append('upload_preset', uploadData.uploadPreset);
      } else if (uploadData.signature) {
        formData.append('signature', uploadData.signature);
        formData.append('timestamp', uploadData.timestamp.toString());
        formData.append('api_key', uploadData.apiKey);
      }

      if (uploadData.folder) {
        formData.append('folder', uploadData.folder);
      }

      const uploadResult = await fetch(uploadData.uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!uploadResult.ok) {
        throw new Error("Failed to upload file");
      }

      const cloudinaryResponse = await uploadResult.json();
      setProfileImageUrl(cloudinaryResponse.secure_url);

      toast({
        title: "Success!",
        description: "Profile image uploaded successfully. Don't forget to save your changes.",
      });
    } catch (error) {
      console.error("Profile image upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload profile image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingProfileImage(false);
    }
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const isValid = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isValid) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a PDF or image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10485760) { // 10MB
      toast({
        title: "File Too Large",
        description: "Document must be less than 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingDocument(true);

    try {
      // Use user ID for organized folder structure
      const folder = user?.id
        ? `verification-documents/${user.id}`
        : "verification-documents";

      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folder,
          resourceType: file.type === 'application/pdf' ? 'raw' : 'image'
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const uploadData = await uploadResponse.json();

      const formData = new FormData();
      formData.append('file', file);

      if (uploadData.uploadPreset) {
        formData.append('upload_preset', uploadData.uploadPreset);
      } else if (uploadData.signature) {
        formData.append('signature', uploadData.signature);
        formData.append('timestamp', uploadData.timestamp.toString());
        formData.append('api_key', uploadData.apiKey);
      }

      if (uploadData.folder) {
        formData.append('folder', uploadData.folder);
      }

      const uploadResult = await fetch(uploadData.uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!uploadResult.ok) {
        throw new Error("Failed to upload file");
      }

      const cloudinaryResponse = await uploadResult.json();
      setVerificationDocumentUrl(cloudinaryResponse.secure_url);

      toast({
        title: "Success!",
        description: "Verification document uploaded successfully. Don't forget to save your changes.",
      });
    } catch (error) {
      console.error("Document upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingDocument(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      queryClient.clear();
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
      setIsLoggingOut(false);
    }
  };

  const handleExportData = async () => {
    try {
      setIsExportingData(true);

      const response = await fetch("/api/user/export-data", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to export data");
      }

      // Get the JSON data
      const data = await response.json();

      // Create a blob and download it
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `user-data-${user?.id}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Your data has been exported successfully.",
      });
    } catch (error: any) {
      console.error("Export data error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingData(false);
    }
  };

  // Handle email change verification with password
  const handleVerifyEmailChange = async () => {
    try {
      setIsVerifyingEmail(true);

      // Basic validation
      if (!newEmail) {
        toast({
          title: "Error",
          description: "Please enter a new email address.",
          variant: "destructive",
        });
        return;
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        toast({
          title: "Error",
          description: "Please enter a valid email address.",
          variant: "destructive",
        });
        return;
      }

      // For OAuth users, verify directly without password
      if (user?.googleId && !user?.password) {
        const response = await fetch("/api/auth/verify-email-change", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            newEmail: newEmail.trim(),
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to verify email change");
        }

        setIsEmailVerified(true);
        toast({
          title: "Verified",
          description: "You can now update your email address.",
        });
        return;
      }

      // For local auth users, require password
      if (!emailChangePassword) {
        toast({
          title: "Error",
          description: "Password is required to change your email.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch("/api/auth/verify-email-change", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: emailChangePassword,
          newEmail: newEmail.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to verify email change");
      }

      setIsEmailVerified(true);
      toast({
        title: "Verified",
        description: "Password verified. You can now update your email address.",
      });
    } catch (error: any) {
      console.error("Email verification error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to verify. Please check your password.",
        variant: "destructive",
      });
      setIsEmailVerified(false);
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  // Handle email update after verification
  const handleUpdateEmail = async () => {
    try {
      setIsUpdatingEmail(true);

      const response = await fetch("/api/auth/email", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newEmail: newEmail.trim(),
          password: emailChangePassword || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update email");
      }

      toast({
        title: "Success",
        description: "Email updated successfully. Please verify your new email address.",
      });

      // Reset states
      setShowEmailChange(false);
      setEmailChangePassword("");
      setNewEmail("");
      setIsEmailVerified(false);

      // Refresh user data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (error: any) {
      console.error("Email update error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeletingAccount(true);

      const payload: any = {};

      // Only require password for non-OAuth users
      if (!user?.googleId && user?.password) {
        if (!deletePassword) {
          toast({
            title: "Error",
            description: "Password is required to delete your account.",
            variant: "destructive",
          });
          return;
        }
        payload.password = deletePassword;
      }

      const response = await fetch("/api/user/delete-account", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        // Check if there are active items preventing deletion
        if (result.details && result.activeItems) {
          setActiveItemsDetails(result);
          setShowActiveItemsDialog(true);
          setShowDeleteDialog(false);
          setDeletePassword("");
          return;
        }
        throw new Error(result.error || result.details || "Failed to delete account");
      }

      toast({
        title: "Account Deleted",
        description: result.message || "Your account has been successfully deleted.",
      });

      // Clear everything and redirect to home
      queryClient.clear();
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (error: any) {
      console.error("Delete account error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteDialog(false);
      setDeletePassword("");
    }
  };

  // Toggle niche selection
  const toggleNiche = (niche: string) => {
    setSelectedNiches(prev =>
      prev.includes(niche)
        ? prev.filter(n => n !== niche)
        : [...prev, niche]
    );
  };

  // Remove a specific niche
  const removeNiche = (niche: string) => {
    setSelectedNiches(prev => prev.filter(n => n !== niche));
  };

  const updateAccountMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        username: username.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      };

      if (!payload.username) {
        throw new Error("Username is required");
      }

      const result = await apiRequest("PUT", "/api/auth/account", payload);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Success",
        description: "Account information updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update account information",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!currentPassword) {
        throw new Error("Current password is required");
      }

      if (!newPassword) {
        throw new Error("New password is required");
      }

      if (newPassword.length < 8) {
        throw new Error("New password must be at least 8 characters");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const payload = {
        currentPassword,
        newPassword,
      };

      const result = await apiRequest("PUT", "/api/auth/password", payload);
      return result;
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Success",
        description: "Password changed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      let payload: any = {};

      // Creator profile payload
      if (user?.role === 'creator') {
        console.log("[Settings] Saving niches:", selectedNiches);

        payload = {
          bio,
          profileImageUrl: profileImageUrl || null,
          niches: selectedNiches,
          youtubeUrl,
          tiktokUrl,
          instagramUrl,
          youtubeFollowers: youtubeFollowers ? parseInt(youtubeFollowers) : null,
          tiktokFollowers: tiktokFollowers ? parseInt(tiktokFollowers) : null,
          instagramFollowers: instagramFollowers ? parseInt(instagramFollowers) : null,
        };
      }

      // Company profile payload
      if (user?.role === 'company') {
        payload = {
          tradeName,
          legalName,
          logoUrl,
          industry,
          websiteUrl,
          description: companyDescription,
          contactName,
          contactJobTitle,
          phoneNumber,
          businessAddress,
          companySize,
          yearFounded: yearFounded ? parseInt(yearFounded) : null,
          linkedinUrl,
          twitterUrl,
          facebookUrl,
          instagramUrl: companyInstagramUrl,
          verificationDocumentUrl,
        };
      }

      console.log("[Settings] API payload:", payload);

      const result = await apiRequest("PUT", "/api/profile", payload);
      console.log("[Settings] API response:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Clear saved form data from localStorage since changes are now persisted
      localStorage.removeItem('settings-form-data');
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    },
    onError: (error: Error) => {
      console.log("[Settings] Error caught:", error);
      console.log("[Settings] Error message:", error.message);
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  // Handler for save profile button - checks video platform requirement first
  const handleSaveProfile = () => {
    // Only check for creators
    if (user?.role === 'creator') {
      const hasVideoPlatform = youtubeUrl || tiktokUrl || instagramUrl;
      if (!hasVideoPlatform) {
        setShowVideoPlatformDialog(true);
        return;
      }
    }

    // Proceed with save
    updateProfileMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNavBar />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-1">Manage your account preferences</p>
          </div>
        </div>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage
                src={profileImageUrl || user?.profileImageUrl || ''}
                alt={user?.firstName || 'User'}
                referrerPolicy="no-referrer"
              />
              <AvatarFallback className="text-lg">{user?.firstName?.[0] || user?.email?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold">{user?.firstName} {user?.lastName}</div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
              <div className="text-xs text-muted-foreground capitalize mt-1">{user?.role} Account</div>
            </div>
          </div>

          <Separator />

          {/* COMPANY PROFILE SECTION */}
          {user?.role === 'company' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="tradeName" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company Name (Trade Name) *
                </Label>
                <Input
                  id="tradeName"
                  type="text"
                  placeholder="Your Company Name"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  data-testid="input-trade-name"
                />
                <p className="text-xs text-muted-foreground">
                  This is the name that will appear on all your offers
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoUrl">Company Logo *</Label>
                <div className="space-y-4">
                  {logoUrl ? (
                    <div className="relative inline-block">
                      <div className="flex items-center gap-4 p-4 border rounded-lg">
                        <Avatar className="h-24 w-24">
                          <AvatarImage src={logoUrl} alt={tradeName || 'Company logo'} />
                          <AvatarFallback className="text-2xl">
                            {tradeName?.[0] || 'C'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">Current Logo</p>
                          <p className="text-sm text-muted-foreground">This logo will appear on all your offers</p>
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
                              <div className="text-xs text-muted-foreground">
                                Recommended: 500x500px or larger, square format
                              </div>
                            </>
                          )}
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="legalName">Legal Company Name</Label>
                <Input
                  id="legalName"
                  type="text"
                  placeholder="Official registered company name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  data-testid="input-legal-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger id="industry" data-testid="select-industry">
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="ecommerce">E-commerce</SelectItem>
                    <SelectItem value="fashion">Fashion & Apparel</SelectItem>
                    <SelectItem value="beauty">Beauty & Cosmetics</SelectItem>
                    <SelectItem value="health">Health & Wellness</SelectItem>
                    <SelectItem value="fitness">Fitness</SelectItem>
                    <SelectItem value="food">Food & Beverage</SelectItem>
                    <SelectItem value="travel">Travel & Hospitality</SelectItem>
                    <SelectItem value="finance">Finance & Insurance</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="entertainment">Entertainment</SelectItem>
                    <SelectItem value="gaming">Gaming</SelectItem>
                    <SelectItem value="home">Home & Garden</SelectItem>
                    <SelectItem value="automotive">Automotive</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Company Website</Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  placeholder="https://yourcompany.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  data-testid="input-website-url"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyDescription">Company Description</Label>
                <Textarea
                  id="companyDescription"
                  placeholder="Tell creators about your company, products, and what makes you unique..."
                  value={companyDescription}
                  onChange={(e) => setCompanyDescription(e.target.value)}
                  className="min-h-32"
                  data-testid="textarea-company-description"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name</Label>
                  <Input
                    id="contactName"
                    type="text"
                    placeholder="Primary contact person"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    data-testid="input-contact-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactJobTitle">Contact Job Title</Label>
                  <Input
                    id="contactJobTitle"
                    type="text"
                    placeholder="Marketing Director, CEO, etc."
                    value={contactJobTitle}
                    onChange={(e) => setContactJobTitle(e.target.value)}
                    data-testid="input-contact-job-title"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    data-testid="input-phone-number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessAddress">Business Address</Label>
                <Textarea
                  id="businessAddress"
                  placeholder="Full business address including street, city, state, ZIP, and country"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  className="min-h-20"
                  data-testid="textarea-business-address"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companySize">Company Size</Label>
                  <Select value={companySize} onValueChange={setCompanySize}>
                    <SelectTrigger id="companySize" data-testid="select-company-size">
                      <SelectValue placeholder="Select company size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10 employees</SelectItem>
                      <SelectItem value="11-50">11-50 employees</SelectItem>
                      <SelectItem value="51-200">51-200 employees</SelectItem>
                      <SelectItem value="201-1000">201-1000 employees</SelectItem>
                      <SelectItem value="1000+">1000+ employees</SelectItem>
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
                    placeholder={new Date().getFullYear().toString()}
                    value={yearFounded}
                    onChange={(e) => setYearFounded(e.target.value)}
                    data-testid="input-year-founded"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-base font-semibold">Verification Document</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload business registration certificate, EIN/Tax ID, or incorporation certificate
                </p>

                {verificationDocumentUrl ? (
                  <div className="flex items-center gap-3 p-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200">
                    <FileText className="h-8 w-8 text-green-600" />
                    <div className="flex-1">
                      <p className="font-medium text-green-900 dark:text-green-100">Document Uploaded</p>
                      <p className="text-sm text-green-700 dark:text-green-300">Verification document on file</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setVerificationDocumentUrl("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
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
                            <FileText className="h-6 w-6 text-primary" />
                            <div className="text-sm font-medium">
                              Click to upload verification document
                            </div>
                            <div className="text-xs text-muted-foreground">
                              PDF, JPG, PNG (max 10MB)
                            </div>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-base font-semibold">Social Media Profiles</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Optional: Add your social media profiles to build trust with creators
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="linkedinUrl">LinkedIn Company Page</Label>
                    <Input
                      id="linkedinUrl"
                      type="url"
                      placeholder="https://linkedin.com/company/yourcompany"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      data-testid="input-linkedin-url"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="twitterUrl">Twitter/X Profile</Label>
                    <Input
                      id="twitterUrl"
                      type="url"
                      placeholder="https://twitter.com/yourcompany"
                      value={twitterUrl}
                      onChange={(e) => setTwitterUrl(e.target.value)}
                      data-testid="input-twitter-url"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="facebookUrl">Facebook Page</Label>
                    <Input
                      id="facebookUrl"
                      type="url"
                      placeholder="https://facebook.com/yourcompany"
                      value={facebookUrl}
                      onChange={(e) => setFacebookUrl(e.target.value)}
                      data-testid="input-facebook-url"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyInstagramUrl">Instagram Profile</Label>
                    <Input
                      id="companyInstagramUrl"
                      type="url"
                      placeholder="https://instagram.com/yourcompany"
                      value={companyInstagramUrl}
                      onChange={(e) => setCompanyInstagramUrl(e.target.value)}
                      data-testid="input-company-instagram-url"
                    />
                  </div>
                </div>
              </div>

              {/* Show warning if critical fields are missing */}
              {(!tradeName || !logoUrl) && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ Important:</strong> Please fill in your Company Name and upload a Logo. 
                    These are required for your offers to display properly.
                  </p>
                </div>
              )}

              <Button
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}

          {/* CREATOR PROFILE SECTION */}
          {user?.role === 'creator' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="profileImage">Profile Image</Label>
                <p className="text-sm text-muted-foreground">
                  Upload a profile picture to personalize your account.
                </p>

                {profileImageUrl ? (
                  <div className="relative inline-block">
                    <div className="flex items-center gap-4 p-4 border rounded-lg">
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={profileImageUrl} alt={user?.firstName || 'Creator profile'} />
                        <AvatarFallback className="text-2xl">
                          {user?.firstName?.[0] || user?.username?.[0] || 'C'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">Current Profile Image</p>
                        <p className="text-sm text-muted-foreground">This image will appear on your creator profile.</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2"
                      onClick={() => setProfileImageUrl("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfileImageUpload}
                      disabled={isUploadingProfileImage}
                      className="hidden"
                      id="profile-image-upload"
                    />
                    <label
                      htmlFor="profile-image-upload"
                      className={`border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer block ${
                        isUploadingProfileImage ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        {isUploadingProfileImage ? (
                          <>
                            <Upload className="h-8 w-8 text-blue-600 animate-pulse" />
                            <div className="text-sm font-medium text-blue-600">
                              Uploading Image...
                            </div>
                          </>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-primary" />
                            <div className="text-sm font-medium">
                              Click to upload profile image
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
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell companies about yourself and your audience..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="min-h-24"
                  data-testid="textarea-bio"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="niches">Content Niches</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                      data-testid="button-select-niches"
                    >
                      {selectedNiches.length === 0 ? (
                        <span className="text-muted-foreground">Select your content niches...</span>
                      ) : (
                        <span>{selectedNiches.length} niche{selectedNiches.length !== 1 ? 's' : ''} selected</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <div className="max-h-[300px] overflow-y-auto p-4 space-y-2">
                      {nichesLoading ? (
                        <div className="text-sm text-muted-foreground p-2">Loading niches...</div>
                      ) : AVAILABLE_NICHES.length === 0 ? (
                        <div className="text-sm text-muted-foreground p-2">No niches available</div>
                      ) : (
                        AVAILABLE_NICHES.map((niche) => (
                          <div key={niche.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`niche-${niche.value}`}
                              checked={selectedNiches.includes(niche.value)}
                              onCheckedChange={() => toggleNiche(niche.value)}
                            />
                            <label
                              htmlFor={`niche-${niche.value}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                            >
                              {niche.label}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Display selected niches as badges */}
                {selectedNiches.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedNiches.map((nicheValue) => {
                      const niche = AVAILABLE_NICHES.find(n => n.value === nicheValue);
                      return (
                        <Badge key={nicheValue} variant="secondary" className="gap-1">
                          {niche?.label || nicheValue}
                          <button
                            type="button"
                            onClick={() => removeNiche(nicheValue)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Your niches help us recommend relevant offers. Select all that apply to your content.
                </p>
              </div>

              {/* Video Platform Requirement Alert */}
              <Alert className={`${!youtubeUrl && !tiktokUrl && !instagramUrl ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'}`}>
                <Video className={`h-5 w-5 ${!youtubeUrl && !tiktokUrl && !instagramUrl ? 'text-red-600' : 'text-blue-600'}`} />
                <AlertTitle className={!youtubeUrl && !tiktokUrl && !instagramUrl ? 'text-red-900 dark:text-red-300' : 'text-blue-900 dark:text-blue-300'}>
                  {!youtubeUrl && !tiktokUrl && !instagramUrl ? '⚠️ Video Platform Required' : '✓ Video Platform Requirements'}
                </AlertTitle>
                <AlertDescription className={!youtubeUrl && !tiktokUrl && !instagramUrl ? 'text-red-800 dark:text-red-200' : 'text-blue-800 dark:text-blue-200'}>
                  {!youtubeUrl && !tiktokUrl && !instagramUrl ? (
                    <>
                      <strong>You must add at least one video platform to use AffiliateXchange.</strong>
                      <br />
                      We only accept video content creators (YouTube, TikTok, or Instagram). Text-only bloggers and podcasters without video are not supported at this time.
                    </>
                  ) : (
                    <>
                      <strong>Great!</strong> You have at least one video platform set up. Make sure to keep your platform URLs updated for the best experience.
                    </>
                  )}
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="youtube">YouTube Channel URL</Label>
                  <Input
                    id="youtube"
                    type="url"
                    placeholder="https://youtube.com/@yourchannel"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    data-testid="input-youtube"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtube-followers">YouTube Subscribers</Label>
                  <Input
                    id="youtube-followers"
                    type="number"
                    placeholder="10000"
                    value={youtubeFollowers}
                    onChange={(e) => setYoutubeFollowers(e.target.value)}
                    data-testid="input-youtube-followers"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="tiktok">TikTok Profile URL</Label>
                  <Input
                    id="tiktok"
                    type="url"
                    placeholder="https://tiktok.com/@yourusername"
                    value={tiktokUrl}
                    onChange={(e) => setTiktokUrl(e.target.value)}
                    data-testid="input-tiktok"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktok-followers">TikTok Followers</Label>
                  <Input
                    id="tiktok-followers"
                    type="number"
                    placeholder="50000"
                    value={tiktokFollowers}
                    onChange={(e) => setTiktokFollowers(e.target.value)}
                    data-testid="input-tiktok-followers"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="instagram">Instagram Profile URL</Label>
                  <Input
                    id="instagram"
                    type="url"
                    placeholder="https://instagram.com/yourusername"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    data-testid="input-instagram"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram-followers">Instagram Followers</Label>
                  <Input
                    id="instagram-followers"
                    type="number"
                    placeholder="25000"
                    value={instagramFollowers}
                    onChange={(e) => setInstagramFollowers(e.target.value)}
                    data-testid="input-instagram-followers"
                  />
                </div>
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username *</Label>
            <Input
              id="username"
              type="text"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              data-testid="input-username"
            />
            <p className="text-xs text-muted-foreground">
              Your unique username for the platform
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                data-testid="input-first-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                data-testid="input-last-name"
              />
            </div>
          </div>

          <Button
            onClick={() => updateAccountMutation.mutate()}
            disabled={updateAccountMutation.isPending}
            data-testid="button-save-account"
          >
            {updateAccountMutation.isPending ? "Saving..." : "Save Account Info"}
          </Button>
        </CardContent>
      </Card>

      {/* Email Change Section */}
      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Change Email Address
          </CardTitle>
          <CardDescription>
            Update your account email address. {user?.googleId && !user?.password ? "As an OAuth user, you can change your email directly." : "You'll need to verify your password to change your email."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showEmailChange ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Current Email</div>
                <div className="text-sm text-muted-foreground">{user?.email}</div>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowEmailChange(true)}
              >
                Change Email
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Email Change</AlertTitle>
                <AlertDescription>
                  Changing your email will require you to verify the new email address. You'll receive verification emails at both your old and new addresses.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="current-email-display">Current Email</Label>
                <Input
                  id="current-email-display"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-email">New Email Address *</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="newemail@example.com"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setIsEmailVerified(false); // Reset verification when email changes
                  }}
                  disabled={isEmailVerified}
                />
              </div>

              {requiresPasswordForEmailChange && (
                <div className="space-y-2">
                  <Label htmlFor="email-change-password">Current Password *</Label>
                  <Input
                    id="email-change-password"
                    type="password"
                    placeholder="Enter your current password"
                    value={emailChangePassword}
                    onChange={(e) => {
                      setEmailChangePassword(e.target.value);
                      setIsEmailVerified(false); // Reset verification when password changes
                    }}
                    disabled={isEmailVerified}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your password is required to verify this change
                  </p>
                </div>
              )}

              {!isEmailVerified ? (
                <div className="flex gap-2">
                  <Button
                    onClick={handleVerifyEmailChange}
                    disabled={
                      isVerifyingEmail ||
                      !newEmail ||
                      (requiresPasswordForEmailChange && !emailChangePassword)
                    }
                  >
                    {isVerifyingEmail ? "Verifying..." : "Verify & Enable Change"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEmailChange(false);
                      setEmailChangePassword("");
                      setNewEmail("");
                      setIsEmailVerified(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                    <Shield className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-900 dark:text-green-100">Verified</AlertTitle>
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      You can now update your email address.
                    </AlertDescription>
                  </Alert>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleUpdateEmail}
                      disabled={isUpdatingEmail}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isUpdatingEmail ? "Updating..." : "Update Email Address"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowEmailChange(false);
                        setEmailChangePassword("");
                        setNewEmail("");
                        setIsEmailVerified(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!user?.googleId && (
        <Card className="border-card-border">
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password *</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                data-testid="input-current-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                data-testid="input-confirm-password"
              />
            </div>

            <Button
              onClick={() => changePasswordMutation.mutate()}
              disabled={changePasswordMutation.isPending}
              data-testid="button-change-password"
            >
              {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Data
          </CardTitle>
          <CardDescription>
            Manage your data and privacy settings in compliance with GDPR/CCPA regulations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="font-medium">Export Your Data</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Download a copy of all your personal data including profile information,
                  applications, messages, payments, and analytics in JSON format.
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleExportData}
                disabled={isExportingData}
                className="flex-shrink-0"
              >
                {isExportingData ? (
                  <>Exporting...</>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                  </>
                )}
              </Button>
            </div>

            {/* Delete Account - Only for creators and companies, not admins */}
            {user?.role !== 'admin' && (
              <>
                <Separator />

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium text-destructive">Delete Account</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Permanently delete your account and all associated data. This action cannot
                      be undone.
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isDeletingAccount}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Log Out</div>
              <div className="text-sm text-muted-foreground">Sign out of your account</div>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={isLoggingOut}
              data-testid="button-logout"
            >
              {isLoggingOut ? "Logging out..." : "Log Out"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Video Platform Requirement Dialog */}
      <AlertDialog open={showVideoPlatformDialog} onOpenChange={setShowVideoPlatformDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-6 w-6" />
              ⚠️ Video Platform Required
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 text-base">
              <p className="font-semibold text-foreground">
                You must add at least one video platform to use AffiliateXchange.
              </p>
              <p>
                We only accept <strong>video content creators</strong> with presence on:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li><strong>YouTube</strong> - Video channels</li>
                <li><strong>TikTok</strong> - Short-form video content</li>
                <li><strong>Instagram</strong> - Reels and video content</li>
              </ul>
              <p className="text-muted-foreground">
                Text-only bloggers and podcasters without video are not supported at this time.
              </p>
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>💡 Tip:</strong> Add your YouTube, TikTok, or Instagram URL in the fields above, then click Save Changes again.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowVideoPlatformDialog(false)}>
              I Understand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Confirmation Dialog - Only for creators and companies */}
      {user?.role !== 'admin' && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete Account - Are you absolutely sure?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  This action <strong>cannot be undone</strong>. This will permanently delete
                  your account and remove all your data from our servers.
                </p>
                <div className="bg-muted p-3 rounded-md text-sm">
                  <p className="font-semibold mb-2">The following data will be deleted:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Personal information (email, name, profile)</li>
                    <li>Payment information and settings</li>
                    <li>Profile images and uploaded content</li>
                    <li>Applications and favorites</li>
                    <li>Notifications and preferences</li>
                  </ul>
                </div>
                <div className="bg-muted p-3 rounded-md text-sm">
                  <p className="font-semibold mb-2">The following will be kept (anonymized):</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Reviews (content kept, author anonymized)</li>
                    <li>Messages (content kept, sender anonymized)</li>
                  </ul>
                </div>
                {!user?.googleId && (
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="delete-password">
                      Enter your password to confirm deletion:
                    </Label>
                    <Input
                      id="delete-password"
                      type="password"
                      placeholder="Enter your password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                    />
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletePassword("")}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingAccount ? "Deleting..." : "Yes, delete my account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Active Items Warning Dialog - Only for creators and companies */}
      {user?.role !== 'admin' && (
        <AlertDialog open={showActiveItemsDialog} onOpenChange={setShowActiveItemsDialog}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-6 w-6" />
                Cannot Delete Account - Active Activities Found
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4 text-base">
                <p className="font-semibold text-foreground">
                  You have active activities that must be completed or cancelled before deleting your account.
                </p>

                {activeItemsDetails && (
                  <div className="space-y-3">
                    {activeItemsDetails.details.applications > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                        <p className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                          {activeItemsDetails.details.applications} Active Application{activeItemsDetails.details.applications > 1 ? 's' : ''}
                        </p>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          {user?.role === 'creator'
                            ? 'You have active offers you are working on. Please complete or cancel these applications first.'
                            : 'You have active applications from creators. Please complete or cancel these applications first.'}
                        </p>
                      </div>
                    )}

                    {activeItemsDetails.details.retainerContracts > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                        <p className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                          {activeItemsDetails.details.retainerContracts} Active Retainer Contract{activeItemsDetails.details.retainerContracts > 1 ? 's' : ''}
                        </p>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          {user?.role === 'creator'
                            ? 'You are currently assigned to active retainer contracts. Please complete or cancel these contracts first.'
                            : 'You have active retainer contracts with creators. Please complete or cancel these contracts first.'}
                        </p>
                      </div>
                    )}

                    {activeItemsDetails.details.retainerApplications > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                        <p className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                          {activeItemsDetails.details.retainerApplications} Pending Retainer Application{activeItemsDetails.details.retainerApplications > 1 ? 's' : ''}
                        </p>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          You have pending retainer applications. Please wait for them to be processed or cancel them first.
                        </p>
                      </div>
                    )}

                    {activeItemsDetails.details.offersWithApplications > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                        <p className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                          {activeItemsDetails.details.offersWithApplications} Active Offer{activeItemsDetails.details.offersWithApplications > 1 ? 's' : ''} with Applications
                        </p>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          You have active offers with creator applications. Please complete or cancel these offers first.
                        </p>
                      </div>
                    )}

                    {activeItemsDetails.details.pendingPayments > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                        <p className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                          {activeItemsDetails.details.pendingPayments} Pending Payment{activeItemsDetails.details.pendingPayments > 1 ? 's' : ''}
                        </p>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          You have pending or processing payments. Please wait for them to complete before deleting your account.
                        </p>
                      </div>
                    )}

                    {activeItemsDetails.details.pendingDeliverables > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                        <p className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                          {activeItemsDetails.details.pendingDeliverables} Pending Deliverable{activeItemsDetails.details.pendingDeliverables > 1 ? 's' : ''}
                        </p>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          You have pending or revision-requested deliverables. Please submit final versions or cancel the associated retainer contracts first.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>💡 What to do:</strong> Go to your {user?.role === 'creator' ? 'applications or retainer contracts' : 'offers or retainer contracts'} page and complete or cancel all active items. Then you can return here to delete your account.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setShowActiveItemsDialog(false)}>
                I Understand
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      </div>
    </div>
  );
}