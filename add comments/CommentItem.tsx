/**
 * CommentItem - Individual comment with admin controls, reporting, and own-comment deletion
 * Simplified version without thread lines - uses flat structure with @mentions
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Eye, EyeOff, Flag, MessageSquare, Pen, ThumbsUp, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOptionalUser } from '../../contexts/UserContext';
import { getClientIdentity } from '../../utils/comments/identityTracking.client';
import { getSupabaseBrowserClient } from '../../utils/supabaseClient';
import { maskProfanity } from '../../utils/comments/profanityTiers';
import { renderCommentMarkdown } from '../../utils/comments/commentMarkdown';
import { normalizeCommentDisplayName, isOfficialAdmin, OFFICIAL_ADMIN_MARKER } from '../../utils/comments/displayName';
import { useAnimatedEmojis } from '../../hooks/useAnimatedEmojis';
import type { Comment } from './CommentSection';
import CommentForm from './CommentForm';

export interface CommentItemProps {
  comment: Comment;
  onDelete?: (commentId: string) => void;
  onEdit?: (comment: Comment) => void;
  onReplySubmit?: (content: string, parentId?: string | null) => Promise<{ success: boolean; error?: string }>;
  currentUserIdentityHash?: string;
  parentUsername?: string; // Username of the parent comment author for reply context
  commentsById?: Record<string, Comment>; // For looking up usernames in @mentions
  depth?: number; // Nesting depth for gradient coloring
  onTypingActivity?: () => void;
}

// Pastel colors that cycle for thread depth visualization
// Uses HSL with soft saturation and high lightness for pastel effect
// Note: Yellow is reserved for @mention highlighting, so excluded here
const DEPTH_COLORS = [
  'hsl(350, 55%, 88%)', // Pink
  'hsl(25, 60%, 88%)',  // Peach/Orange
  'hsl(140, 45%, 88%)', // Mint/Green
  'hsl(200, 50%, 88%)', // Sky Blue
  'hsl(270, 45%, 88%)', // Lavender
  'hsl(320, 50%, 88%)', // Magenta/Rose
];

// SVG Depth indicator - shows circled number for comment depth
// Parent = 1, children = 2, grandchildren = 3, etc.
function DepthIndicator({ depth }: { depth: number }) {
  const displayNum = depth + 1; // depth 0 = "1", depth 1 = "2", etc.
  const numStr = String(displayNum);

  // Calculate font size - shrinks for larger numbers to fit in circle
  let fontSize = 10;
  if (displayNum >= 100) {
    fontSize = 6;
  } else if (displayNum >= 10) {
    fontSize = 8;
  }

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      className="flex-shrink-0"
    >
      <circle
        cx="8"
        cy="8"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <text
        x="8"
        y="8"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fill="currentColor"
        fontFamily="system-ui, sans-serif"
      >
        {numStr}
      </text>
    </svg>
  );
}

// Get the gradient style for a given depth - applies to the comment panel itself
function getDepthGradient(depth: number): React.CSSProperties {
  // Parent comments (depth 0) get no gradient - just the neutral background
  if (depth === 0) {
    return { backgroundColor: 'rgb(250, 250, 250)' }; // neutral-50
  }

  // Replies get gradient colors (depth 1 = first color, depth 2 = second, etc.)
  const colorIndex = (depth - 1) % DEPTH_COLORS.length;
  const color = DEPTH_COLORS[colorIndex];

  // Gradient from pastel color on left fading to the panel's base background color
  const panelBg = 'rgb(250, 250, 250)'; // neutral-50
  return {
    background: `linear-gradient(to right, ${color} 0%, ${panelBg} 50%)`,
  };
}

export default function CommentItem({
  comment,
  onDelete,
  onEdit,
  onReplySubmit,
  currentUserIdentityHash,
  parentUsername,
  commentsById = {},
  depth = 0,
  onTypingActivity,
}: CommentItemProps) {
  const userContext = useOptionalUser();
  const [showReportForm, setShowReportForm] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<'own' | null>(null);
  const [likeCount, setLikeCount] = useState(comment.like_count ?? 0);
  const [hasLiked, setHasLiked] = useState(false);
  const [showEditInlinePreview, setShowEditInlinePreview] = useState(false);
  const [actionBarVisible, setActionBarVisible] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editPreviewRef = useRef<HTMLDivElement>(null);
  const actionBarTimeoutRef = useRef<number | null>(null);
  const commentContentRef = useRef<HTMLDivElement>(null);

  const createdAt = new Date(comment.created_at);
  const timeAgo = getTimeAgo(createdAt);
  const fullTimestamp = formatFullTimestamp(createdAt);
  const editedTimestamp = comment.edited_at ? formatFullTimestamp(new Date(comment.edited_at)) : null;

  // Check if this comment belongs to the current user
  const isOwnComment = useMemo(() => {
    if (!currentUserIdentityHash) {
      return false;
    }
    return comment.identity_hash === currentUserIdentityHash;
  }, [comment.identity_hash, currentUserIdentityHash]);

  // Check if this is an official admin comment
  const rawAuthorName = (isOwnComment && userContext.user?.displayUsername)
    ? userContext.user.displayUsername
    : comment.author_username || 'Anonymous';
  const isOfficial = isOfficialAdmin(rawAuthorName) || isOfficialAdmin(comment.author_username);

  // Display name: Use user's display name for their own comments, otherwise use generated username
  // For official admin, normalizeCommentDisplayName returns undefined so we fall back to 'Anonymous'
  // but we handle official rendering separately
  const displayName = isOfficial
    ? 'MSTRJK'
    : normalizeCommentDisplayName(rawAuthorName) ?? 'Anonymous';

  const maskedContent = useMemo(() => maskProfanity(comment.content), [comment.content]);
  const baseRenderedContent = useMemo(
    () => renderCommentMarkdown(maskedContent, commentsById, currentUserIdentityHash),
    [maskedContent, commentsById, currentUserIdentityHash]
  );
  const renderedContent = baseRenderedContent;

  // Initialize animated emojis in the comment content
  useAnimatedEmojis(commentContentRef, [renderedContent]);

  const editPreview = useMemo(
    () => renderCommentMarkdown(editContent, commentsById, currentUserIdentityHash),
    [editContent, commentsById, currentUserIdentityHash]
  );
  const isDeleted = comment.is_admin_removed || comment.content === '[Comment deleted]';

  useEffect(() => {
    setEditContent(comment.content);
  }, [comment.content]);

  const resizeEditTextarea = useCallback(() => {
    if (!editTextareaRef.current) {
      return;
    }

    const textarea = editTextareaRef.current;
    textarea.style.height = 'auto';
    const newHeight = Math.max(textarea.scrollHeight, 120);
    textarea.style.height = `${newHeight}px`;

    if (editPreviewRef.current) {
      editPreviewRef.current.style.minHeight = `${newHeight}px`;
    }

    // Scroll to keep cursor visible, accounting for 12px fixed bottom scrollbar
    const cursorPosition = textarea.selectionEnd;
    const textBeforeCursor = textarea.value.substring(0, cursorPosition);
    const linesBefore = textBeforeCursor.split('\n').length;

    // Calculate approximate cursor Y position within textarea
    const lineHeight = 20;
    const cursorYInTextarea = linesBefore * lineHeight;

    // Get textarea's position in the viewport
    const textareaRect = textarea.getBoundingClientRect();
    const cursorYInViewport = textareaRect.top + cursorYInTextarea;

    // Account for 12px fixed bottom scrollbar + some padding
    const bottomScrollbarHeight = 12;
    const padding = 20;
    const safeBottomBoundary = window.innerHeight - bottomScrollbarHeight - padding;

    // If cursor would be below the safe area, scroll to bring it into view
    if (cursorYInViewport > safeBottomBoundary) {
      const scrollAmount = cursorYInViewport - safeBottomBoundary + padding;
      window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    resizeEditTextarea();
  }, [editContent, isEditing, resizeEditTextarea]);

  useEffect(() => {
    return () => {
      if (actionBarTimeoutRef.current) {
        window.clearTimeout(actionBarTimeoutRef.current);
        actionBarTimeoutRef.current = null;
      }
    };
  }, []);

  // Subscribe to realtime like updates for this comment
  // Uses postgres_changes to listen for INSERT (new like) and DELETE (unlike) on comment_likes table
  // Filters out current user's own actions since those are handled by the API response
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const channelName = `likes:${comment.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comment_likes',
          filter: `comment_id=eq.${comment.id}`,
        },
        (payload) => {
          const likeData = payload.new as { identity_hash?: string };
          // Skip if this is the current user's own like (already handled by API response)
          if (currentUserIdentityHash && likeData.identity_hash === currentUserIdentityHash) {
            return;
          }
          setLikeCount((prev) => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comment_likes',
          filter: `comment_id=eq.${comment.id}`,
        },
        (payload) => {
          const likeData = payload.old as { identity_hash?: string };
          // Skip if this is the current user's own unlike (already handled by API response)
          if (currentUserIdentityHash && likeData.identity_hash === currentUserIdentityHash) {
            return;
          }
          setLikeCount((prev) => Math.max(0, prev - 1));
        }
      );

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
      } else if (status === 'CHANNEL_ERROR') {
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [comment.id, currentUserIdentityHash]);

  const handleLike = async () => {
    if (liking) {
      return;
    }

    setLiking(true);
    setActionError(null);

    try {
      const identity = getClientIdentity();
      const response = await fetch('/api/public/comments/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId: comment.id,
          sessionId: identity.sessionId,
          localStorageId: identity.localStorageId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update like');
      }

      setHasLiked(data.liked);
      setLikeCount(data.likeCount ?? likeCount);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update like');
    } finally {
      setLiking(false);
    }
  };

  const handleReplySubmit = async (content: string, parentId?: string | null) => {
    if (!onReplySubmit) {
      return { success: false, error: 'Replies are unavailable.' };
    }

    const result = await onReplySubmit(content, parentId);
    if (result.success) {
      setShowReplyForm(false);
    }
    return result;
  };

  const handleReport = async () => {
    setReportSubmitting(true);
    setReportError(null);

    try {
      const identity = getClientIdentity();

      const response = await fetch('/api/public/comments/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId: comment.id,
          reason: reportReason,
          details: reportDetails || null,
          sessionId: identity.sessionId,
          localStorageId: identity.localStorageId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit report');
      }

      setReportSuccess(true);
      setShowReportForm(false);
      setTimeout(() => setReportSuccess(false), 3000);
    } catch (err: any) {
      setReportError(err.message || 'Failed to submit report');
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleDeleteOwn = async () => {
    setDeleting(true);
    setActionError(null);

    try {
      const identity = getClientIdentity();

      const response = await fetch('/api/public/comments/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId: comment.id,
          sessionId: identity.sessionId,
          localStorageId: identity.localStorageId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete comment');
      }

      if (onDelete) {
        onDelete(comment.id);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete comment');
      setDeleting(false);
    }
  };

  const handleEditToggle = () => {
    setEditError(null);
    setIsEditing((prev) => !prev);
    setEditContent(comment.content);
    setShowEditInlinePreview(false);
  };

  const handleEditSubmit = async () => {
    if (editSubmitting) {
      return;
    }

    const trimmed = editContent.trim();
    const hasLinks = /https?:\/\//i.test(editContent) || /www\./i.test(editContent);

    if (!trimmed) {
      setEditError('Please enter a valid comment.');
      return;
    }

    if (trimmed.length > 10000) {
      setEditError('Comment exceeds maximum length of 10,000 characters.');
      return;
    }

    if (hasLinks) {
      setEditError('Comments cannot contain links.');
      return;
    }

    setEditSubmitting(true);
    setEditError(null);

    try {
      const identity = getClientIdentity();
      const response = await fetch('/api/public/comments/edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId: comment.id,
          content: trimmed,
          sessionId: identity.sessionId,
          localStorageId: identity.localStorageId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to edit comment');
      }

      setIsEditing(false);
      if (onEdit && data.comment) {
        onEdit(data.comment as Comment);
      }
    } catch (err: any) {
      setEditError(err.message || 'Failed to edit comment');
    } finally {
      setEditSubmitting(false);
    }
  };

  const depthGradientStyle = getDepthGradient(depth);

  const clearActionBarTimeout = () => {
    if (actionBarTimeoutRef.current) {
      window.clearTimeout(actionBarTimeoutRef.current);
      actionBarTimeoutRef.current = null;
    }
  };

  const showActionBar = () => {
    clearActionBarTimeout();
    setActionBarVisible(true);
  };

  const scheduleHideActionBar = (delay = 1200) => {
    clearActionBarTimeout();
    actionBarTimeoutRef.current = window.setTimeout(() => {
      setActionBarVisible(false);
      actionBarTimeoutRef.current = null;
    }, delay);
  };

  return (
    <div className="comment-item flex items-start gap-2" id={`comment-${comment.id}`}>
      {/* Depth indicator */}
      <div className="flex-shrink-0 mt-3 text-neutral-500">
        <DepthIndicator depth={depth} />
      </div>

      {/* Comment panel */}
      <div
        className="flex-1 skeuo-content-panel rounded-lg p-4 border border-neutral-200 relative group"
        style={depthGradientStyle}
        onMouseEnter={showActionBar}
        onMouseLeave={() => scheduleHideActionBar(200)}
        onFocus={showActionBar}
        onBlur={() => scheduleHideActionBar(200)}
        onPointerDown={showActionBar}
        onPointerUp={() => scheduleHideActionBar()}
        onPointerCancel={() => scheduleHideActionBar()}
      >
        {!isDeleted && (
          <div className="absolute right-3 top-3">
            <div
              className={`flex items-center gap-2 rounded-full border border-neutral-200 bg-white/90 px-2 py-1 shadow-sm transition-opacity duration-150 ${
                actionBarVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
              onMouseEnter={showActionBar}
              onMouseLeave={() => scheduleHideActionBar(200)}
            >
              <Tooltip label={showReplyForm ? 'Hide replies' : 'Reply'}>
                <button
                  onClick={() => setShowReplyForm((prev) => !prev)}
                  aria-label={showReplyForm ? 'Hide replies' : 'Reply'}
                  className="flex items-center justify-center text-neutral-500 hover:text-neutral-700 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </Tooltip>

              <Tooltip label={hasLiked ? 'Unlike' : 'Like'}>
                <button
                  onClick={handleLike}
                  disabled={liking}
                  aria-label={hasLiked ? 'Unlike' : 'Like'}
                  className={`flex items-center justify-center text-xs ${hasLiked ? 'text-blue-600' : 'text-neutral-500'} hover:text-neutral-700 transition-colors disabled:text-neutral-400 disabled:cursor-not-allowed`}
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>
              </Tooltip>

              {isOwnComment && (
                <Tooltip label={isEditing ? 'Cancel edit' : 'Edit'}>
                  <button
                    onClick={handleEditToggle}
                    aria-label={isEditing ? 'Cancel edit' : 'Edit'}
                    className="flex items-center justify-center text-neutral-700 hover:text-neutral-900 transition-colors"
                  >
                    <Pen className="w-4 h-4" strokeWidth={1.25} />
                  </button>
                </Tooltip>
              )}

              {isOwnComment && (
                <Tooltip label="Delete">
                  <button
                    onClick={() => setDeleteConfirm('own')}
                    disabled={deleting}
                    aria-label="Delete"
                    className="flex items-center justify-center text-red-600 hover:text-red-800 transition-colors disabled:text-neutral-400 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}

              {!isOwnComment && (
                <Tooltip label={showReportForm ? 'Hide report' : 'Report'}>
                  <button
                    onClick={() => setShowReportForm((prev) => !prev)}
                    aria-label={showReportForm ? 'Hide report form' : 'Report'}
                    className="flex items-center justify-center text-neutral-500 hover:text-neutral-700 transition-colors"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-between items-start mb-2 pr-24">
          <div className="text-sm text-neutral-500">
            {isOfficial ? (
              <span className="font-semibold">
                <span
                  style={{
                    background: 'linear-gradient(90deg, #7addfb, #5fcffa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  MSTRJK
                </span>
                {' '}
                <span
                  style={{
                    background: 'linear-gradient(90deg, #5fcffa, #1bacf8)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  (Official)
                </span>
              </span>
            ) : (
              <span className="font-medium text-neutral-700">
                {displayName}
              </span>
            )}
            {isOwnComment && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                You
              </span>
            )}
            {' '}
            {comment.parent_comment_id && (
              <span className="ml-2 text-xs text-neutral-500">
                replied to{' '}
                <a
                  href={`#comment-${comment.parent_comment_id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const target = document.getElementById(`comment-${comment.parent_comment_id}`);
                    if (target) {
                      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      // Flash highlight
                      target.classList.add('ring-2', 'ring-blue-400');
                      setTimeout(() => target.classList.remove('ring-2', 'ring-blue-400'), 2000);
                    }
                  }}
                  className="underline underline-offset-2 hover:text-neutral-700"
                >
                  a comment
                </a>
              </span>
            )}
            {' '}
            <Tooltip label={fullTimestamp}>
              <span className="ml-2" suppressHydrationWarning>{timeAgo}</span>
            </Tooltip>
          </div>

          <div />
        </div>

        {!isEditing && (
          <>
            <div ref={commentContentRef} className="comment-markdown text-neutral-900" style={{ overflowWrap: 'anywhere' }}>
              <span dangerouslySetInnerHTML={{ __html: isDeleted ? '[Comment deleted]' : renderedContent }} />
              {editedTimestamp && !isDeleted && (
                <>
                  {' '}
                  <Tooltip label={editedTimestamp}>
                    <span className="comment-edited-tag text-xs text-neutral-400">(Edited)</span>
                  </Tooltip>
                </>
              )}
            </div>
            {!isDeleted && likeCount > 0 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-neutral-500">
                <ThumbsUp className="w-3 h-3" />
                <span>{likeCount}</span>
              </div>
            )}
          </>
        )}

        <Expandable open={isEditing && !isDeleted} className="mt-3">
          <div className="skeuo-content-panel skeuo-glass-panel p-3 md:p-6 mb-12 mt-8 transition-shadow focus-within:ring-2 focus-within:ring-blue-500">
            <div className="flex items-end gap-3">
              <div className="relative flex-1 min-h-[120px]">
                <textarea
                  ref={editTextareaRef}
                  value={editContent}
                  onChange={(event) => setEditContent(event.target.value)}
                  onInput={resizeEditTextarea}
                  className={`w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none resize-none min-h-[120px] ${
                    showEditInlinePreview ? 'hidden' : ''
                  }`}
                  maxLength={10000}
                />
                {showEditInlinePreview && (
                  <div
                    ref={editPreviewRef}
                    className="comment-markdown text-sm text-neutral-900 min-h-[120px] cursor-text"
                    onClick={() => setShowEditInlinePreview(false)}
                    dangerouslySetInnerHTML={{ __html: editPreview || '<span class="text-neutral-500">Click to edit...</span>' }}
                  />
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditInlinePreview(!showEditInlinePreview)}
                  className="skeuo-icon-button-inset"
                  aria-label={showEditInlinePreview ? "Show raw text" : "Show preview"}
                  title={showEditInlinePreview ? "Show raw text" : "Show preview"}
                >
                  {showEditInlinePreview ? <EyeOff className="w-5 h-5" strokeWidth={1.25} /> : <Eye className="w-5 h-5" strokeWidth={1.25} />}
                </button>
              </div>
            </div>
          </div>
          {editError && (
            <div className="mt-3 skeuo-footer-panel bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded">
              {editError}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="skeuo-button"
              onClick={handleEditSubmit}
              disabled={editSubmitting}
            >
              {editSubmitting ? 'Saving...' : 'Save changes'}
            </button>
            <button
              type="button"
              className="skeuo-button"
              onClick={handleEditToggle}
              disabled={editSubmitting}
            >
              Cancel
            </button>
          </div>
        </Expandable>

        <Expandable open={Boolean(deleteConfirm)} className="mt-3">
          <div className="skeuo-content-panel skeuo-glass-panel bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="text-sm font-semibold">Delete this comment?</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="skeuo-button !text-red-700 !border-red-200 !bg-neutral-100 hover:!bg-neutral-200"
                onClick={() => {
                  setDeleteConfirm(null);
                  handleDeleteOwn();
                }}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Confirm delete'}
              </button>
              <button
                type="button"
                className="skeuo-button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        </Expandable>

        <Expandable open={Boolean(actionError)} className="mt-3">
          <div className="skeuo-footer-panel bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded">
            {actionError}
          </div>
        </Expandable>

        {reportSuccess && (
          <div className="mt-3 text-sm text-green-600">
            Report submitted successfully. Thank you for helping keep our community safe.
          </div>
        )}

        <Expandable open={showReportForm && !reportSuccess} className="mt-4">
          <div className="p-4 bg-white rounded border border-neutral-300">
            <h4 className="font-semibold mb-2 text-sm">Report Comment</h4>

            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full p-2 border border-neutral-300 rounded mb-2 text-sm"
            >
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="hate_speech">Hate Speech</option>
              <option value="inappropriate">Inappropriate Content</option>
              <option value="other">Other</option>
            </select>

            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Additional details (optional)"
              className="w-full p-2 border border-neutral-300 rounded mb-2 text-sm"
              rows={2}
            />

            {reportError && (
              <div className="text-sm text-red-600 mb-2">{reportError}</div>
            )}

            <div className="flex space-x-2">
              <button
                onClick={handleReport}
                disabled={reportSubmitting}
                className="skeuo-button !text-red-700 !border-red-200 !bg-neutral-100 hover:!bg-neutral-200 disabled:opacity-60"
              >
                {reportSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>

              <button
                onClick={() => setShowReportForm(false)}
                className="skeuo-button"
              >
                Cancel
              </button>
            </div>
          </div>
        </Expandable>

        <Expandable open={showReplyForm && !isDeleted} className="mt-4">
          <CommentForm
            onSubmit={handleReplySubmit}
            parentId={comment.id}
            parentUsername={isOfficial ? OFFICIAL_ADMIN_MARKER : (parentUsername || displayName)}
            onTypingActivity={onTypingActivity}
          />
        </Expandable>
      </div>
    </div>
  );
}

function Tooltip({
  label,
  children,
  tooltipClassName = '',
  position = 'top',
}: {
  label: string;
  children: React.ReactNode;
  tooltipClassName?: string;
  position?: 'top' | 'bottom';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const positionStyle = position === 'top' ? { bottom: '100%', marginBottom: '8px' } : { top: '100%', marginTop: '8px' };

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      {children}
      <span
        suppressHydrationWarning
        style={positionStyle}
        className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded skeuo-footer-panel px-2 py-1 text-[10px] text-black shadow-sm transition-opacity duration-150 ${isOpen ? 'opacity-100' : 'opacity-0'} ${tooltipClassName}`}
      >
        {label}
      </span>
    </span>
  );
}

function Expandable({
  open,
  className = '',
  children,
}: {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={className}
          initial={{ opacity: 0, height: 0, y: -10 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: -10 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Helper function to format time ago
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString();
}

function formatFullTimestamp(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
}
