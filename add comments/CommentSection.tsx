/**
 * CommentSection - Main comment container component
 *
 * Features:
 * - Load comments for a specific page
 * - Display comment list with threading
 * - Comment submission form
 * - Skeleton loading states
 * - Empty states
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getClientIdentity } from '../../utils/comments/identityTracking.client';
import { getSupabaseBrowserClient } from '../../utils/supabaseClient';
import { useOptionalUser } from '../../contexts/UserContext';
import CommentList from './CommentList';
import CommentForm from './CommentForm';
import AnonTermsModal, { ANON_TERMS_KEY } from './AnonTermsModal';
import AnonKeyModal, { ANON_KEY_SAVED_KEY } from './AnonKeyModal';

const ANON_KEY_STORAGE_KEY = 'comment_anon_key';

function generateAnonKey(): string {
  const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  const letters = Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
  return `AK_${digits}_${letters}`;
}

export interface Comment {
  id: string;
  page_type: string;
  page_slug: string;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
  edited_at?: string | null;
  abuse_score: number;
  is_shadow_banned: boolean;
  is_admin_removed: boolean;
  report_count: number;
  author_username: string;
  identity_hash: string;
  like_count?: number;
}

export interface CommentSectionProps {
  pageType: 'artist' | 'article' | 'music' | 'song';
  pageSlug: string;
}

type TypingUser = { key: string; name: string };

export default function CommentSection({ pageType, pageSlug }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserIdentityHash, setCurrentUserIdentityHash] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [anonKey, setAnonKey] = useState<string | null>(null);
  const [pendingAnonUsername, setPendingAnonUsername] = useState<string | null>(null);
  const userContext = useOptionalUser();
  const isAuthenticated = userContext.isAuthenticated;
  const authLoading = userContext.loading;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const typingLabel = useMemo(() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].name} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`;
    return `${typingUsers.length} people are typing...`;
  }, [typingUsers]);

  // Fetch current user's identity hash on mount
  useEffect(() => {
    const fetchIdentity = async () => {
      try {
        const identity = getClientIdentity();
        const response = await fetch('/api/public/comments/identity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: identity.sessionId,
            localStorageId: identity.localStorageId,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setCurrentUserIdentityHash(data.identityHash);
        }
      } catch (err) {
      }
    };

    fetchIdentity();
  }, []);

  // Load existing anon key once auth state resolves
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) return;

    const existingKey = localStorage.getItem(ANON_KEY_STORAGE_KEY);
    if (existingKey) {
      setAnonKey(existingKey);
    }
  }, [authLoading, isAuthenticated]);

  const handleTermsAccept = () => {
    setShowTermsModal(false);
    // Generate and cache the anon key now, so it's ready for the first post
    let key = localStorage.getItem(ANON_KEY_STORAGE_KEY);
    if (!key) {
      key = generateAnonKey();
      localStorage.setItem(ANON_KEY_STORAGE_KEY, key);
    }
    setAnonKey(key);
  };

  // Load comments
  useEffect(() => {
    loadComments();
  }, [pageType, pageSlug]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const loadComments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/public/comments?pageType=${pageType}&pageSlug=${encodeURIComponent(pageSlug)}`
      );

      if (!response.ok) {
        throw new Error('Failed to load comments');
      }

      const data = await response.json();
      setComments(data.comments || []);
    } catch (err) {
      setError('Failed to load comments. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (content: string, parentCommentId?: string | null) => {
    // Show terms modal if anon user hasn't agreed yet
    if (!isAuthenticated) {
      const agreed = localStorage.getItem(ANON_TERMS_KEY);
      if (!agreed) {
        setShowTermsModal(true);
        return { success: false, error: 'Please agree to the terms first.' };
      }
    }

    try {
      setSubmitting(true);
      setError(null);

      const identity = getClientIdentity();

      const response = await fetch('/api/public/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageType,
          pageSlug,
          content,
          parentCommentId,
          sessionId: identity.sessionId,
          localStorageId: identity.localStorageId,
          anonKey: !isAuthenticated ? anonKey : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to post comment');
      }

      const newComment = data.comment as Comment | null;

      if (newComment) {
        setComments((prev) => (prev.some((comment) => comment.id === newComment.id) ? prev : [...prev, newComment]));
      } else {
        // Reload comments to show new one if not returned
        await loadComments();
      }

      updateTypingPresence(false);

      // Show anon key modal on first successful anon post (if key not yet saved)
      if (data.isFirstAnonPost && !localStorage.getItem(ANON_KEY_SAVED_KEY)) {
        setPendingAnonUsername(data.anonUsername ?? null);
        setShowKeyModal(true);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setSubmitting(false);
    }
  };

  const updateTypingPresence = useCallback(
    (isTyping: boolean) => {
      if (!presenceChannelRef.current || !currentUserIdentityHash) {
        return;
      }

      const displayName = userContext.user?.displayUsername?.trim() || 'Anonymous';
      presenceChannelRef.current.track({
        key: currentUserIdentityHash,
        name: displayName,
        isTyping,
      });
    },
    [currentUserIdentityHash, userContext.user?.displayUsername]
  );

  const handleTypingActivity = useCallback(() => {
    updateTypingPresence(true);
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      updateTypingPresence(false);
    }, 1500);
  }, [updateTypingPresence]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    // Use Supabase's postgres_changes with filters for this specific page
    const channelName = `comments:${pageType}:${pageSlug}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `page_slug=eq.${pageSlug}`,
        },
        (payload) => {
          const newComment = payload.new as Comment;
          if (!newComment || newComment.is_shadow_banned || newComment.page_type !== pageType) {
            return;
          }
          setComments((prev) =>
            prev.some((comment) => comment.id === newComment.id) ? prev : [...prev, newComment]
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'comments',
          filter: `page_slug=eq.${pageSlug}`,
        },
        (payload) => {
          const updatedComment = payload.new as Comment;
          if (!updatedComment || updatedComment.page_type !== pageType) {
            return;
          }
          // Shadow banned comments should be hidden from others
          if (updatedComment.is_shadow_banned) {
            setComments((prev) => prev.filter((comment) => comment.id !== updatedComment.id));
          } else if (updatedComment.is_admin_removed) {
            // Admin removed comments show "[Comment deleted]" placeholder
            setComments((prev) =>
              prev.map((comment) =>
                comment.id === updatedComment.id
                  ? { ...comment, ...updatedComment, content: '[Comment deleted]' }
                  : comment
              )
            );
          } else {
            setComments((prev) =>
              prev.map((comment) => (comment.id === updatedComment.id ? { ...comment, ...updatedComment } : comment))
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
          filter: `page_slug=eq.${pageSlug}`,
        },
        (payload) => {
          const deletedComment = payload.old as Comment;
          if (!deletedComment || deletedComment.page_type !== pageType) {
            return;
          }
          setComments((prev) => prev.filter((comment) => comment.id !== deletedComment.id));
        }
      );

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
      } else if (status === 'CHANNEL_ERROR') {
      } else if (status === 'TIMED_OUT') {
      } else if (status === 'CLOSED') {
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, pageSlug, pageType]);

  useEffect(() => {
    if (!supabase || !currentUserIdentityHash) {
      return;
    }

    const channel = supabase.channel(`comments-presence:${pageType}:${pageSlug}`, {
      config: {
        presence: {
          key: currentUserIdentityHash,
        },
      },
    });

    presenceChannelRef.current = channel;

    const updateTypingState = () => {
      const state = channel.presenceState();
      const allEntries = Object.values(state).flatMap(
        (entries) => entries as Array<{ key?: string; name?: string; isTyping?: boolean }>
      );

      const typing = allEntries
        .filter((entry) => {
          return entry.isTyping;
        })
        .map((entry) => ({
          key: entry.key || 'unknown',
          name: entry.name || 'Someone',
        }))
        .filter((entry) => entry.key !== currentUserIdentityHash);

      const uniqueTyping = Array.from(new Map(typing.map((entry) => [entry.key, entry])).values());
      setTypingUsers(uniqueTyping);
    };

    channel.on('presence', { event: 'sync' }, updateTypingState);
    channel.on('presence', { event: 'join' }, updateTypingState);
    channel.on('presence', { event: 'leave' }, updateTypingState);

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        updateTypingPresence(false);
      }
    });

    return () => {
      updateTypingPresence(false);
      supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
  }, [supabase, currentUserIdentityHash, pageType, pageSlug, updateTypingPresence]);

  const handleDelete = async (commentId: string) => {
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === commentId
          ? { ...comment, content: '[Comment deleted]', is_admin_removed: true }
          : comment
      )
    );
  };

  const handleEdit = async (updatedComment: Comment) => {
    setComments((prev) =>
      prev.map((comment) => (comment.id === updatedComment.id ? { ...comment, ...updatedComment } : comment))
    );
  };

  // Loading skeleton - matches CommentItem structure
  if (loading) {
    return (
      <div className="comment-section max-w-4xl mx-auto px-4 py-8">
        <h3 className="text-2xl font-bold mb-6">Comments</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-2 animate-pulse">
              {/* Depth indicator skeleton */}
              <div className="flex-shrink-0 mt-3">
                <div className="w-4 h-4 rounded-full bg-neutral-200" />
              </div>
              {/* Comment panel skeleton */}
              <div className="flex-1 skeuo-content-panel rounded-lg p-4 border border-neutral-200">
                {/* Header: username + timestamp */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-24 bg-neutral-200 rounded" />
                    <div className="h-3 w-16 bg-neutral-200 rounded" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-4 w-12 bg-neutral-200 rounded" />
                    <div className="h-4 w-8 bg-neutral-200 rounded" />
                  </div>
                </div>
                {/* Content lines */}
                <div className="space-y-2">
                  <div className="h-4 w-full bg-neutral-200 rounded" />
                  <div className="h-4 w-3/4 bg-neutral-200 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  const isEmpty = comments.length === 0;

  return (
    <div className="comment-section max-w-4xl mx-auto px-4 py-8">
      {/* Anon terms modal – shown once per browser for unauthenticated users */}
      {showTermsModal && !isAuthenticated && (
        <AnonTermsModal onAccept={handleTermsAccept} />
      )}

      {/* Anon key modal – shown after first successful anonymous post */}
      {showKeyModal && anonKey && pendingAnonUsername && (
        <AnonKeyModal
          anonKey={anonKey}
          username={pendingAnonUsername}
          onDismiss={() => setShowKeyModal(false)}
        />
      )}

      <h3 className="text-2xl font-bold mb-6">Comments</h3>

      {error && (
        <div className="skeuo-footer-panel bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <CommentForm onSubmit={handleSubmit} disabled={submitting} onTypingActivity={handleTypingActivity} />

      {typingLabel && (
        <div className="typing-indicator text-sm text-neutral-500 italic mb-4 flex items-center gap-2">
          <span className="typing-dots flex gap-1">
            <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
          <span>{typingLabel}</span>
        </div>
      )}

      {isEmpty ? (
        <div className="text-center py-12">
          <p className="text-neutral-500 text-lg">Be the first to comment!</p>
        </div>
      ) : (
        <CommentList
          comments={comments}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onReplySubmit={handleSubmit}
          currentUserIdentityHash={currentUserIdentityHash || undefined}
          onTypingActivity={handleTypingActivity}
        />
      )}
    </div>
  );
}
