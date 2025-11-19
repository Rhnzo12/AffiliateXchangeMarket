import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  MessageSquare,
  Search,
  Check,
  CheckCheck,
  ArrowLeft,
  Building2,
  User
} from "lucide-react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { TopNavBar } from "../components/TopNavBar";

interface EnhancedMessage {
  id: string;
  senderId: string;
  content: string;
  attachments?: string[];
  createdAt: string;
  isRead: boolean;
}

export default function AdminMessages() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) {
      window.location.href = "/";
    }
  }, [isAuthenticated, isLoading, user]);

  const { data: conversations = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/conversations", searchQuery],
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const { data: messages = [] } = useQuery<EnhancedMessage[]>({
    queryKey: ["/api/admin/messages", selectedConversation],
    enabled: !!selectedConversation && isAuthenticated && user?.role === 'admin',
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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
    return timeDiff < 60000; // Group if within 1 minute
  };

  const currentConversation = conversations?.find((c: any) => c.id === selectedConversation);
  const creator = currentConversation?.creator;
  const company = currentConversation?.company;

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <TopNavBar />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Message Monitoring</h1>
          <p className="text-muted-foreground mt-2">
            View and monitor all conversations across the platform
          </p>
        </div>
      </div>

      <div className="h-[calc(100vh-16rem)]">
        <div className="grid md:grid-cols-[380px_1fr] gap-4 h-full">
          {/* Conversations List */}
          <Card className={`border-card-border flex flex-col overflow-hidden ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
            <CardContent className="p-0 flex flex-col h-full">
              <div className="p-4 border-b shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-lg">All Conversations</h2>
                  <Badge variant="secondary">{conversations.length}</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                {conversations.length === 0 ? (
                  <div className="p-12 text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">No conversations found</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {conversations.map((conversation: any) => (
                      <button
                        key={conversation.id}
                        onClick={() => setSelectedConversation(conversation.id)}
                        className={`w-full p-4 text-left hover-elevate transition-colors ${
                          selectedConversation === conversation.id ? 'bg-accent' : 'hover:bg-accent/50'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Creator Info */}
                          <div className="flex gap-3 items-start">
                            <div className="relative">
                              <Avatar className="h-10 w-10 shrink-0">
                                <AvatarImage src={conversation.creator?.profileImageUrl} />
                                <AvatarFallback>
                                  {conversation.creator?.firstName?.[0] || 'C'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                                <User className="h-3 w-3 text-primary" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate text-sm">
                                {conversation.creator?.name}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                Creator
                              </div>
                            </div>
                          </div>

                          {/* Company Info */}
                          <div className="flex gap-3 items-start">
                            <div className="relative">
                              <Avatar className="h-10 w-10 shrink-0">
                                <AvatarImage src={conversation.company?.logoUrl} />
                                <AvatarFallback>
                                  {conversation.company?.name?.[0] || 'C'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                                <Building2 className="h-3 w-3 text-primary" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate text-sm">
                                {conversation.company?.name}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                Company
                              </div>
                            </div>
                          </div>

                          {/* Offer & Last Message */}
                          <div className="pt-2 border-t">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="font-medium text-sm truncate">
                                {conversation.offerTitle}
                              </div>
                              <div className="text-xs text-muted-foreground shrink-0">
                                {conversation.lastMessageAt &&
                                  formatMessageDate(conversation.lastMessageAt)}
                              </div>
                            </div>
                            {conversation.lastMessage && (
                              <div className="text-sm text-muted-foreground truncate">
                                {conversation.lastMessage}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Messages View */}
          <Card className={`border-card-border flex flex-col overflow-hidden ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
            {!selectedConversation ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center px-4">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">Select a conversation to view messages</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Monitor conversations between creators and companies
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
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
                      <div>
                        <h3 className="font-semibold">
                          {creator?.name} ↔ {company?.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {currentConversation?.offerTitle}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {messages.length} messages
                    </Badge>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages?.map((message, index) => {
                      const previousMessage = index > 0 ? messages[index - 1] : null;
                      const showDateSeparator = shouldShowDateSeparator(message, previousMessage);
                      const groupWithPrevious = shouldGroupMessage(message, previousMessage);
                      const isCreatorMessage = message.senderId === creator?.id;
                      const sender = isCreatorMessage ? creator : company;

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
                            className={`flex gap-2 ${
                              groupWithPrevious ? 'mt-1' : 'mt-4'
                            }`}
                          >
                            <Avatar className={`h-8 w-8 shrink-0 ${groupWithPrevious ? 'invisible' : ''}`}>
                              <AvatarImage src={sender?.profileImageUrl || sender?.logoUrl} />
                              <AvatarFallback className="text-xs">
                                {sender?.firstName?.[0] || sender?.name?.[0] || 'U'}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 max-w-[85%] sm:max-w-[70%]">
                              {!groupWithPrevious && (
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium">
                                    {sender?.name}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {isCreatorMessage ? 'Creator' : 'Company'}
                                  </Badge>
                                </div>
                              )}

                              <div className="rounded-2xl px-4 py-2.5 bg-muted rounded-tl-md">
                                {/* Attachments */}
                                {message.attachments && message.attachments.length > 0 && (
                                  <div className="mb-2 space-y-2">
                                    {message.attachments.map((url, idx) => (
                                      <a
                                        key={idx}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block"
                                      >
                                        <img
                                          src={url}
                                          alt={`Attachment ${idx + 1}`}
                                          className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                                          style={{ maxHeight: '300px' }}
                                        />
                                      </a>
                                    ))}
                                  </div>
                                )}

                                {message.content && (
                                  <p className="text-sm sm:text-base whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                                )}

                                <div className="flex items-center gap-1 mt-1">
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(message.createdAt), 'h:mm a')}
                                  </p>
                                  {message.isRead ? (
                                    <CheckCheck className="h-3 w-3 text-muted-foreground" />
                                  ) : (
                                    <Check className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
