import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "../lib/queryClient";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";
import {
  Send,
  MessageSquare,
  Image as ImageIcon,
  Check,
  CheckCheck,
  WifiOff,
  Loader2,
  Bell,
  BellOff,
  ArrowLeft,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { TopNavBar } from "../components/TopNavBar";
import { MessageTemplates } from "../components/MessageTemplates";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { proxiedSrc } from "../lib/image";
import { MessageItemSkeleton } from "../components/skeletons";

type MessageStatus = "sending" | "sent" | "failed";

interface EnhancedMessage {
  id: string;
  senderId: string;
  content: string;
  attachments?: string[];
  createdAt: string;
  isRead: boolean;
  status?: MessageStatus;
  tempId?: string;
}

export default function Messages() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();
  
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const conversationFromUrl = urlParams.get('conversation');
  const applicationFromUrl = urlParams.get('application');

  const [selectedConversation, setSelectedConversation] = useState<string | null>(conversationFromUrl);
  const [messageText, setMessageText] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('messageSoundEnabled');
    return saved === null ? true : saved === 'true';
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [attachmentPreviews, setAttachmentPreviews] = useState<string[]>([]);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  // Image viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const [imageZoom, setImageZoom] = useState(1);
  
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageCountRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const selectedConversationRef = useRef<string | null>(selectedConversation);
  const userIdRef = useRef<string | undefined>(user?.id);
  const userRoleRef = useRef<string | undefined>(user?.role);

  // Image viewer functions
  const openImageViewer = (images: string[], startIndex: number = 0) => {
    setCurrentImages(images);
    setCurrentImageIndex(startIndex);
    setImageZoom(1);
    setViewerOpen(true);
  };

  const closeImageViewer = () => {
    setViewerOpen(false);
    setCurrentImages([]);
    setCurrentImageIndex(0);
    setImageZoom(1);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % currentImages.length);
    setImageZoom(1);
  };

  const previousImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + currentImages.length) % currentImages.length);
    setImageZoom(1);
  };

  const zoomIn = () => {
    setImageZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const zoomOut = () => {
    setImageZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const downloadImage = async () => {
    const imageUrl = currentImages[currentImageIndex];
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `image-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download started",
        description: "Image is being downloaded",
      });
    } catch (error) {
      setErrorDialog({
        title: "Download failed",
        message: "Failed to download image",
      });
    }
  };

  // Handle keyboard navigation in image viewer
  useEffect(() => {
    if (!viewerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          closeImageViewer();
          break;
        case 'ArrowLeft':
          if (currentImages.length > 1) previousImage();
          break;
        case 'ArrowRight':
          if (currentImages.length > 1) nextImage();
          break;
        case '+':
        case '=':
          zoomIn();
          break;
        case '-':
        case '_':
          zoomOut();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerOpen, currentImages.length]);

  // Update refs when values change
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
    setTypingUsers(new Set());
  }, [selectedConversation]);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  useEffect(() => {
    userRoleRef.current = user?.role;
  }, [user?.role]);

  const getDisplayName = (user: any) => {
    if (!user) return 'User';
    const companyName = user.tradeName || user.legalName || user.companyName || user.company_name || user.businessName;
    if (companyName) return companyName;
    if (user.role === 'company') {
      return user.name || user.username || user.email || 'Company';
    }
    const displayName = user.firstName || user.first_name || user.name || user.username || user.email;
    return displayName || 'User';
  };

  const getAvatarFallback = (user: any) => {
    if (!user) return 'U';
    const companyName = user.tradeName || user.legalName || user.companyName || user.company_name || user.businessName;
    if (companyName) return companyName[0].toUpperCase();
    const name = user.firstName || user.first_name || user.name || user.username || user.email;
    return name ? name[0].toUpperCase() : 'U';
  };

  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvHZhjMICGS56+OcTgwOUKzk7rdkHQc2jdXy0IEsDipu0ObnllkTClGn4u2yaBcGLXjH8N+OSA==');
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    let shouldReconnect = true;
    
    const connectWebSocket = () => {
      try {
        setIsConnecting(true);
        const socket = new WebSocket(wsUrl);
        
        wsRef.current = socket;
        
        socket.onopen = () => {
          if (socket === wsRef.current) {
            setIsConnecting(false);
            setIsConnected(true);
          }
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'new_message') {
              if (data.message?.conversationId) {
                queryClient.setQueryData<EnhancedMessage[] | undefined>(
                  ["/api/messages", data.message.conversationId],
                  (prev) => {
                    if (!prev) return [data.message];
                    const hasMessage = prev.some((msg) => msg.id === data.message.id);
                    return hasMessage ? prev : [...prev, data.message];
                  }
                );

                queryClient.invalidateQueries({
                  queryKey: ["/api/messages", data.message.conversationId]
                });

                queryClient.setQueryData<any[]>(["/api/conversations"], (prev) => {
                  if (!prev) return prev;

                  return prev.map((conv) => {
                    if (conv.id !== data.message.conversationId) return conv;

                    const isFromSelf = data.message.senderId === userIdRef.current;
                    const isCompanyUser = userRoleRef.current === 'company';
                    const unreadUpdates = isFromSelf
                      ? {}
                      : isCompanyUser
                        ? { companyUnreadCount: (conv.companyUnreadCount || 0) + 1 }
                        : { creatorUnreadCount: (conv.creatorUnreadCount || 0) + 1 };

                    return {
                      ...conv,
                      lastMessage: data.message.content,
                      lastMessageSenderId: data.message.senderId,
                      lastMessageAt: data.message.createdAt,
                      ...unreadUpdates,
                    };
                  });
                });
              }
              queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

              const currentSoundEnabled = localStorage.getItem('messageSoundEnabled');
              const shouldPlaySound = currentSoundEnabled === null ? true : currentSoundEnabled === 'true';
              if (shouldPlaySound && data.message?.senderId !== userIdRef.current && audioRef.current) {
                audioRef.current.play().catch(() => {});
              }
            } else if (data.type === 'user_typing') {
              if (data.conversationId === selectedConversationRef.current) {
                setTypingUsers(prev => new Set(prev).add(data.userId));
              }
            } else if (data.type === 'user_stop_typing') {
              if (data.conversationId === selectedConversationRef.current) {
                setTypingUsers(prev => {
                  const next = new Set(prev);
                  next.delete(data.userId);
                  return next;
                });
              }
            } else if (data.type === 'messages_read') {
              queryClient.invalidateQueries({ 
                queryKey: ["/api/messages", data.conversationId] 
              });
            }
          } catch (error) {
            console.error('WebSocket message parse error:', error);
          }
        };

        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (socket === wsRef.current) {
            setIsConnecting(false);
            setIsConnected(false);
          }
        };

        socket.onclose = () => {
          if (socket === wsRef.current) {
            setIsConnecting(false);
            setIsConnected(false);
            wsRef.current = null;
            
            if (shouldReconnect) {
              reconnectTimeoutRef.current = setTimeout(() => {
                if (shouldReconnect) {
                  connectWebSocket();
                }
              }, 3000);
            }
          }
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
        setIsConnecting(false);
        setIsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      shouldReconnect = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
      
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isAuthenticated]);

  const { data: conversations, isLoading: conversationsLoading } = useQuery<any[]>({
    queryKey: ["/api/conversations"],
    enabled: isAuthenticated,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<EnhancedMessage[]>({
    queryKey: ["/api/messages", selectedConversation],
    enabled: !!selectedConversation && isAuthenticated,
  });

  // Handle conversation parameter from URL
  useEffect(() => {
    if (conversationFromUrl && conversationFromUrl !== selectedConversation) {
      setSelectedConversation(conversationFromUrl);
      // Refetch conversations to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    }
  }, [conversationFromUrl, selectedConversation]);

  // Handle application parameter - find conversation by application ID
  useEffect(() => {
    if (applicationFromUrl && conversations && conversations.length > 0) {
      const matchingConversation = conversations.find(
        (conv: any) => conv.applicationId === applicationFromUrl
      );
      if (matchingConversation && matchingConversation.id !== selectedConversation) {
        setSelectedConversation(matchingConversation.id);
        // Refetch conversations to ensure we have the latest data
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      }
    }
  }, [applicationFromUrl, conversations, selectedConversation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (selectedConversation && isConnected && wsRef.current && user?.id) {
      wsRef.current.send(JSON.stringify({
        type: 'mark_read',
        conversationId: selectedConversation,
        userId: user.id,
      }));
    }

    if (selectedConversation && user?.role) {
      queryClient.setQueryData<any[]>(["/api/conversations"], (prev) => {
        if (!prev) return prev;

        return prev.map((conv) =>
          conv.id === selectedConversation
            ? {
                ...conv,
                ...(user.role === 'company'
                  ? { companyUnreadCount: 0 }
                  : { creatorUnreadCount: 0 }),
              }
            : conv
        );
      });
    }
  }, [selectedConversation, isConnected, user?.id, user?.role, messages.length]);

  const handleTyping = useCallback(() => {
    if (!selectedConversation || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      type: 'typing_start',
      conversationId: selectedConversation,
    }));

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'typing_stop',
          conversationId: selectedConversation,
        }));
      }
    }, 3000);
  }, [selectedConversation]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    const validFiles = fileArray.filter(file => {
      if (!file.type.startsWith('image/')) {
        setErrorDialog({
          title: "Invalid file type",
          message: `${file.name} is not an image file`,
        });
        return false;
      }

      if (file.size > 5 * 1024 * 1024) {
        setErrorDialog({
          title: "File too large",
          message: `${file.name} exceeds 5MB limit`,
        });
        return false;
      }

      return true;
    });

    if (validFiles.length === 0) return;

    const remainingSlots = 3 - selectedFiles.length;
    if (validFiles.length > remainingSlots) {
      setErrorDialog({
        title: "Too many files",
        message: `You can only attach up to 3 images per message`,
      });
      validFiles.splice(remainingSlots);
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setAttachmentPreviews(prev => [...prev, e.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setAttachmentPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (filesToUpload?: File[]): Promise<string[]> => {
  const files = filesToUpload || selectedFiles;
  if (files.length === 0) return [];

  if (!selectedConversation || !user?.id || !user?.role) {
    setErrorDialog({
      title: "Upload Failed",
      message: "Missing conversation or user information",
    });
    return [];
  }

  setUploadingFiles(true);
  const uploadedUrls: string[] = [];

  try {
    // Determine the folder path based on user role - without user_id
    const userType = user.role === 'company' ? 'company' : 'creator';
    const folderPath = `creatorlink/attachments/${selectedConversation}/${userType}`;

    for (const file of files) {
      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          folder: folderPath,
          resourceType: "image"
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const uploadData = await uploadResponse.json();

      // Upload file to Google Cloud Storage using signed URL
      const uploadResult = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": uploadData.contentType || file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!uploadResult.ok) {
        const errorText = await uploadResult.text();
        console.error("GCS upload error:", errorText);
        throw new Error("Failed to upload file to storage");
      }

      // Construct the public URL from the upload response
      const uploadedUrl = `https://storage.googleapis.com/${uploadData.fields.bucket}/${uploadData.fields.key}`;
      uploadedUrls.push(uploadedUrl);
    }

    return uploadedUrls;
  } catch (error) {
    console.error("File upload error:", error);
    setErrorDialog({
      title: "Upload Failed",
      message: "Failed to upload attachments. Please try again.",
    });
    throw error;
  } finally {
    setUploadingFiles(false);
  }
};

  const sendMessage = async () => {
    if (!selectedConversation || (!messageText.trim() && selectedFiles.length === 0) || !user?.id) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing_stop',
        conversationId: selectedConversation,
      }));
    }

    const messageContent = messageText;
    const filesToUpload = [...selectedFiles];
    const previewsToRestore = [...attachmentPreviews];

    setMessageText("");
    setSelectedFiles([]);
    setAttachmentPreviews([]);

    try {
      let uploadedUrls: string[] = [];
      if (filesToUpload.length > 0) {
        uploadedUrls = await uploadFiles(filesToUpload);
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'chat_message',
          conversationId: selectedConversation,
          senderId: user.id,
          content: messageContent || '',
          attachments: uploadedUrls,
        }));

        queryClient.invalidateQueries({
          queryKey: ["/api/messages", selectedConversation]
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/conversations"]
        });
      } else {
        setMessageText(messageContent);
        setSelectedFiles(filesToUpload);
        setAttachmentPreviews(previewsToRestore);
        setErrorDialog({
          title: "Connection Error",
          message: "Real-time messaging is not connected. Trying to reconnect...",
        });
      }
    } catch (error) {
      setMessageText(messageContent);
      setSelectedFiles(filesToUpload);
      setAttachmentPreviews(previewsToRestore);
    } finally {
      setUploadingFiles(false);
    }
  };

  const toggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem('messageSoundEnabled', String(newValue));
    toast({
      title: newValue ? "Sound enabled" : "Sound disabled",
      description: newValue ? "You'll hear a notification for new messages" : "Message sounds are muted",
    });
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return format(date, 'h:mm a');
    if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`;
    return format(date, 'MMM d, h:mm a');
  };

  const formatDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  const shouldShowDateSeparator = (currentMessage: EnhancedMessage, previousMessage: EnhancedMessage | null) => {
    if (!previousMessage) return true;
    return !isSameDay(new Date(currentMessage.createdAt), new Date(previousMessage.createdAt));
  };

  const shouldGroupMessage = (currentMessage: EnhancedMessage, previousMessage: EnhancedMessage | null) => {
    if (!previousMessage) return false;
    if (currentMessage.senderId !== previousMessage.senderId) return false;
    
    const timeDiff = new Date(currentMessage.createdAt).getTime() - new Date(previousMessage.createdAt).getTime();
    return timeDiff < 60000;
  };

  const currentConversation = conversations?.find((c: any) => c.id === selectedConversation);
  const otherUser = currentConversation?.otherUser;
  const isOtherUserTyping = typingUsers.size > 0;
  const isCompany = user?.role === 'company';

  const trackingLink = currentConversation?.application?.trackingLink;
  const creatorName = otherUser?.firstName || otherUser?.name || otherUser?.username || 'there';

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <TopNavBar />
      
      {/* Image Viewer Modal */}
      {viewerOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeImageViewer}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={closeImageViewer}
            className="absolute top-4 right-4 text-white hover:bg-white/20 h-10 w-10 z-10"
          >
            <X className="h-6 w-6" />
          </Button>

          {currentImages.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  previousImage();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12 z-10"
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12 z-10"
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}

          <div className="absolute top-4 left-4 flex gap-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                zoomOut();
              }}
              className="text-white hover:bg-white/20 h-10 w-10"
              disabled={imageZoom <= 0.5}
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
            <span className="text-white bg-black/50 rounded-md px-3 flex items-center text-sm">
              {Math.round(imageZoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                zoomIn();
              }}
              className="text-white hover:bg-white/20 h-10 w-10"
              disabled={imageZoom >= 3}
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                downloadImage();
              }}
              className="text-white hover:bg-white/20 h-10 w-10"
            >
              <Download className="h-5 w-5" />
            </Button>
          </div>

          {currentImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white rounded-md px-4 py-2 text-sm z-10">
              {currentImageIndex + 1} / {currentImages.length}
            </div>
          )}

          <div
            className="max-w-[90vw] max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={proxiedSrc(currentImages[currentImageIndex])}
              alt={`Image ${currentImageIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain transition-transform duration-200"
              style={{ transform: `scale(${imageZoom})` }}
            />
          </div>
        </div>
      )}

      <div className="h-[calc(100vh-12rem)]">
        <div className="grid md:grid-cols-[320px_1fr] gap-4 h-full">
          <Card className={`border-card-border flex flex-col overflow-hidden ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
          <CardContent className="p-0 flex flex-col h-full">
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-lg">Messages</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSound}
                data-testid="button-toggle-sound"
                className="h-10 w-10"
              >
                {soundEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {conversationsLoading ? (
                <div className="divide-y">
                  {[...Array(5)].map((_, i) => (
                    <MessageItemSkeleton key={i} />
                  ))}
                </div>
              ) : !conversations || conversations.length === 0 ? (
                <div className="p-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Apply to offers to start messaging companies
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conversation: any) => {
                    const isUnread = user?.role === 'company'
                      ? conversation.companyUnreadCount > 0
                      : conversation.creatorUnreadCount > 0;

                    const lastMessagePreview =
                      conversation.lastMessageSenderId !== user?.id && isUnread
                        ? "Received new messages"
                        : conversation.lastMessage;

                    const previewClassName = `text-sm truncate ${
                      isUnread ? 'font-semibold text-foreground' : 'text-muted-foreground'
                    }`;

                    return (
                      <button
                        key={conversation.id}
                        onClick={() => setSelectedConversation(conversation.id)}
                        className={`w-full p-4 sm:p-3 text-left hover-elevate transition-colors min-h-[80px] sm:min-h-0 ${
                          selectedConversation === conversation.id ? 'bg-accent' : 'hover:bg-accent/50'
                        }`}
                        data-testid={`conversation-${conversation.id}`}
                      >
                        <div className="flex gap-3 items-start">
                          <Avatar className="h-12 w-12 sm:h-10 sm:w-10 shrink-0">
                            <AvatarImage src={proxiedSrc(conversation.otherUser?.profileImageUrl || conversation.otherUser?.logoUrl)} />
                            <AvatarFallback>
                              {getAvatarFallback(conversation.otherUser)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="font-semibold truncate text-base sm:text-sm">
                                {getDisplayName(conversation.otherUser)}
                              </div>
                              <div className="text-xs text-muted-foreground shrink-0">
                                {conversation.lastMessageAt &&
                                  formatMessageDate(conversation.lastMessageAt)}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground truncate font-medium">
                              {conversation.offerTitle}
                            </div>
                            {conversation.lastMessage && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <div className={previewClassName}>
                                  {lastMessagePreview}
                                </div>
                              </div>
                            )}
                          </div>
                          {isUnread && (
                            <Badge variant="destructive" className="h-5 min-w-5 px-1.5">
                              {user?.role === 'company'
                                ? conversation.companyUnreadCount
                                : conversation.creatorUnreadCount}
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className={`border-card-border flex flex-col overflow-hidden ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-4">
                <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">Select a conversation to start messaging</p>
                <p className="text-sm text-muted-foreground mt-2">
                  All your conversations about affiliate offers appear here
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedConversation(null)}
                      className="md:hidden h-10 w-10 shrink-0"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={proxiedSrc(otherUser?.profileImageUrl || otherUser?.logoUrl)} />
                      <AvatarFallback>
                        {getAvatarFallback(otherUser)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">
                        {getDisplayName(otherUser)}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {conversations?.find((c: any) => c.id === selectedConversation)?.offer?.title}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isConnecting && (
                      <Badge variant="secondary" className="gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Connecting
                      </Badge>
                    )}
                    {!isConnecting && !isConnected && (
                      <Badge variant="destructive" className="gap-1">
                        <WifiOff className="h-3 w-3" />
                        Offline
                      </Badge>
                    )}
                    {!isConnecting && isConnected && (
                      <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        Online
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messagesLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex gap-2 justify-start">
                          <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                          <div className="bg-muted rounded-lg px-4 py-2.5 max-w-[70%] space-y-2">
                            <div className="h-4 w-48 bg-muted-foreground/20 rounded animate-pulse" />
                            <div className="h-3 w-16 bg-muted-foreground/20 rounded animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {messages?.map((message, index) => {
                    const previousMessage = index > 0 ? messages[index - 1] : null;
                    const showDateSeparator = shouldShowDateSeparator(message, previousMessage);
                    const groupWithPrevious = shouldGroupMessage(message, previousMessage);
                    const isOwnMessage = message.senderId === user?.id;
                    return (
                      <div key={message.id}>
                        {showDateSeparator && (
                          <div className="flex items-center justify-center my-4">
                            <Badge variant="secondary" className="text-xs">
                              {formatDateSeparator(message.createdAt)}
                            </Badge>
                          </div>
                        )}
                        <div
                          className={`flex gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'} ${
                            groupWithPrevious ? 'mt-1' : 'mt-4'
                          }`}
                        >
                          {!isOwnMessage && (
                            <Avatar className={`h-8 w-8 shrink-0 ${groupWithPrevious ? 'invisible' : ''}`}>
                              <AvatarImage src={proxiedSrc(otherUser?.profileImageUrl || otherUser?.logoUrl)} />
                              <AvatarFallback className="text-xs">
                                {getAvatarFallback(otherUser)}
                              </AvatarFallback>
                            </Avatar>
                          )}

                          <div
                            className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 ${
                              isOwnMessage
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-muted rounded-bl-md'
                            }`}
                          >
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mb-2 space-y-2">
                                {message.attachments.map((url, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => openImageViewer(message.attachments || [], idx)}
                                    className="block w-full text-left"
                                  >
                                    <img
                                      src={proxiedSrc(url)}
                                      alt={`Attachment ${idx + 1}`}
                                      className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                                      style={{ maxHeight: '300px' }}
                                    />
                                  </button>
                                ))}
                              </div>
                            )}

                            {message.content && (
                              <p className="text-sm sm:text-base whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                            )}

                            <div className="flex items-center justify-end gap-1 mt-1">
                              <p className="text-xs opacity-70">
                                {format(new Date(message.createdAt), 'h:mm a')}
                              </p>
                              {isOwnMessage && (
                                <span className="opacity-70">
                                  {message.isRead ? (
                                    <CheckCheck className="h-3 w-3" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {isOtherUserTyping && (
                    <div className="flex gap-2 justify-start mt-4">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={proxiedSrc(otherUser?.profileImageUrl || otherUser?.logoUrl)} />
                        <AvatarFallback className="text-xs">
                          {getAvatarFallback(otherUser)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-muted rounded-lg p-3 max-w-[70%]">
                        <div className="flex gap-1">
                          <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              <div className="p-3 sm:p-4 border-t bg-background shrink-0">
                {attachmentPreviews.length > 0 && (
                  <div className="mb-3 flex gap-2 flex-wrap">
                    {attachmentPreviews.map((preview, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={preview}
                          alt={`Preview ${idx + 1}`}
                          className="h-20 w-20 object-cover rounded-lg border"
                        />
                        <button
                          onClick={() => removeFile(idx)}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={uploadingFiles}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {/* Image attach button - available for both creators and companies */}
                  <Button
                    variant="outline"
                    size="icon"
                    data-testid="button-attach-image"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFiles || selectedFiles.length >= 3}
                    className="h-11 w-11 shrink-0"
                    title={selectedFiles.length >= 3 ? "Maximum 3 attachments" : "Attach images"}
                  >
                    {uploadingFiles ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ImageIcon className="h-5 w-5" />
                    )}
                  </Button>

                  {/* Message templates - only for companies */}
                  {isCompany && (
                    <MessageTemplates
                      onSelectTemplate={(content) => setMessageText(content)}
                      trackingLink={trackingLink}
                      creatorName={creatorName}
                    />
                  )}

                  <Input
                    ref={messageInputRef}
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => {
                      setMessageText(e.target.value);
                      handleTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    disabled={!isConnected && !isConnecting}
                    data-testid="input-message"
                    className="h-11 text-base"
                  />
                  <Button
                    onClick={() => sendMessage()}
                    disabled={(!messageText.trim() && selectedFiles.length === 0) || !isConnected || uploadingFiles}
                    data-testid="button-send-message"
                    className="h-11 w-11 sm:w-auto sm:px-4 shrink-0"
                  >
                    {uploadingFiles ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                    <span className="hidden sm:inline ml-2">
                      {uploadingFiles ? "Uploading..." : "Send"}
                    </span>
                  </Button>
                </div>
                {!isConnected && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {isConnecting ? "Connecting to chat server..." : "Reconnecting to chat server..."}
                  </p>
                )}
              </div>
            </>
          )}
        </Card>
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