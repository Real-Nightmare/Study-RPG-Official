import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { socialService } from '@/services/social';
import { API_CONFIG } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Users,
  Search,
  UserPlus,
  MessageSquare,
  Send,
  Check,
  X,
  Ban,
  Mail,
} from 'lucide-react';
import type { DirectMessage, FriendUser, SearchUserResult } from '@/types';

export default function SocialPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUserResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Chat
  const [activeFriend, setActiveFriend] = useState<FriendUser | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const acceptedFriends = friends.filter((f) => f.status === 'accepted');
  const incomingRequests = friends.filter((f) => f.status === 'pending' && f.direction === 'incoming');
  const outgoingRequests = friends.filter((f) => f.status === 'pending' && f.direction === 'outgoing');

  const fetchFriends = useCallback(async () => {
    try {
      const data = await socialService.friends();
      setFriends(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load friends:', err);
      setError(t('social.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Realtime socket
  useEffect(() => {
    const url = new URL(API_CONFIG.baseURL);
    const wsUrl = url.origin + '/social';
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const newSocket = io(wsUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
    });

    newSocket.on('connect', () => {
      newSocket.emit('social:subscribe');
    });

    newSocket.on('dm:new', (message: DirectMessage & { from?: string }) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      // Refetch friend list so unread badges / ordering stay fresh.
      fetchFriends();
    });

    newSocket.on('friend:update', () => {
      fetchFriends();
    });

    return () => {
      newSocket.disconnect();
    };
  }, [fetchFriends]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const searchUsers = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await socialService.searchUsers(query.trim());
      setResults(data);
    } catch (err) {
      console.error('Failed to search users:', err);
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (userId: string) => {
    try {
      await socialService.sendRequest(userId);
      setResults((prev) => prev.filter((r) => r.id !== userId));
      await fetchFriends();
    } catch (err) {
      console.error('Failed to send request:', err);
      setError(t('social.requestError'));
    }
  };

  const acceptRequest = async (friendshipId: string) => {
    try {
      await socialService.accept(friendshipId);
      await fetchFriends();
    } catch (err) {
      console.error('Failed to accept request:', err);
    }
  };

  const declineRequest = async (friendshipId: string) => {
    try {
      await socialService.decline(friendshipId);
      await fetchFriends();
    } catch (err) {
      console.error('Failed to decline request:', err);
    }
  };

  const blockUser = async (friend: FriendUser) => {
    if (!window.confirm(t('social.blockConfirm'))) return;
    try {
      await socialService.block(friend.userId);
      if (activeFriend?.userId === friend.userId) setActiveFriend(null);
      await fetchFriends();
    } catch (err) {
      console.error('Failed to block:', err);
    }
  };

  const openChat = async (friend: FriendUser) => {
    setActiveFriend(friend);
    setLoadingMessages(true);
    try {
      const data = await socialService.messages(friend.userId);
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!activeFriend || !draft.trim()) return;
    const content = draft.trim();
    setDraft('');
    try {
      const message = await socialService.sendMessage(activeFriend.userId, content);
      setMessages((prev) => [...prev, message]);
    } catch (err) {
      console.error('Failed to send message:', err);
      setDraft(content);
      setError(t('social.sendError'));
    }
  };

  const isMine = (message: DirectMessage) => message.senderId === user?.id;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-sky-600" />
            {t('social.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('social.subtitle')}</p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column: search + friends */}
          <div className="space-y-6 lg:col-span-1">
            {/* Search users */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Search className="h-4 w-4 text-sky-600" />
                  {t('social.findFriends')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder={t('social.searchPlaceholder')}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (!e.target.value) setResults([]);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                  />
                  <Button onClick={searchUsers} disabled={searching} size="icon" variant="outline">
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                {results.length > 0 && (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                    {results.map((result) => {
                      const existing = friends.find((f) => f.userId === result.id);
                      return (
                        <div key={result.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-xs font-semibold text-sky-600">
                            {result.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{result.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {result.username ? `@${result.username}` : result.email ?? ''}
                            </p>
                          </div>
                          {existing ? (
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {t(`social.status.${existing.status}`)}
                            </Badge>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => sendRequest(result.id)}>
                              <UserPlus className="h-3.5 w-3.5" />
                              {t('social.add')}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Friend requests */}
            {incomingRequests.length > 0 && (
              <Card className="border-amber-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Mail className="h-4 w-4 text-amber-500" />
                    {t('social.requests')} ({incomingRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {incomingRequests.map((friend) => (
                    <div key={friend.userId} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-medium">{friend.name}</span>
                      <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => acceptRequest(friend.userId)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => declineRequest(friend.userId)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Friends list */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-sky-600" />
                  {t('social.friends')} ({acceptedFriends.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : acceptedFriends.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">{t('social.noFriends')}</p>
                ) : (
                  <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                    {acceptedFriends.map((friend) => (
                      <button
                        key={friend.userId}
                        onClick={() => openChat(friend)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                          activeFriend?.userId === friend.userId && 'border-sky-500/40 bg-sky-500/5',
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-xs font-semibold text-sky-600">
                          {friend.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="min-w-0 flex-1 truncate font-medium">{friend.name}</span>
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
                {outgoingRequests.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t pt-3">
                    {outgoingRequests.map((friend) => (
                      <div key={friend.userId} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm">
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{friend.name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {t('social.pending')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column: chat */}
          <div className="lg:col-span-2">
            <Card className="flex h-[calc(100vh-14rem)] flex-col">
              {!activeFriend ? (
                <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/40" />
                  <p className="font-medium">{t('social.selectFriend')}</p>
                  <p className="text-sm text-muted-foreground">{t('social.selectFriendHint')}</p>
                </CardContent>
              ) : (
                <>
                  {/* Chat header */}
                  <CardHeader className="border-b py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/10 text-sm font-semibold text-sky-600">
                          {activeFriend.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{activeFriend.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {activeFriend.username ? `@${activeFriend.username}` : activeFriend.email ?? ''}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => blockUser(activeFriend)}>
                        <Ban className="h-4 w-4" />
                        {t('social.block')}
                      </Button>
                    </div>
                  </CardHeader>

                  {/* Messages */}
                  <CardContent className="flex-1 space-y-2 overflow-y-auto">
                    {loadingMessages ? (
                      <div className="flex justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : messages.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">{t('social.noMessages')}</p>
                    ) : (
                      <AnimatePresence initial={false}>
                        {messages.map((message) => (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn('flex', isMine(message) ? 'justify-end' : 'justify-start')}
                          >
                            <div
                              className={cn(
                                'max-w-[75%] rounded-2xl px-4 py-2 text-sm',
                                isMine(message)
                                  ? 'rounded-br-sm bg-sky-600 text-white'
                                  : 'rounded-bl-sm bg-muted',
                              )}
                            >
                              <p className="whitespace-pre-wrap break-words">{message.body}</p>
                              <p
                                className={cn(
                                  'mt-1 text-[10px]',
                                  isMine(message) ? 'text-sky-200' : 'text-muted-foreground',
                                )}
                              >
                                {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                    <div ref={messagesEndRef} />
                  </CardContent>

                  {/* Composer */}
                  <CardContent className="border-t pt-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder={t('social.messagePlaceholder')}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      <Button onClick={sendMessage} disabled={!draft.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </>
              )}
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
