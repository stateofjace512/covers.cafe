import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Heart, Flag, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getClientIdentity } from '../lib/comments/identityTracking.client';
import { supabase } from '../lib/supabase';

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  author_username: string;
  like_count: number | null;
}

interface Props {
  coverId: string;
}

export default function CoverComments({ coverId }: Props) {
  const { user, session, openAuthModal } = useAuth();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const identity = useMemo(() => (typeof window === 'undefined' ? null : getClientIdentity()), []);

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    }),
    [session?.access_token],
  );

  const loadComments = useCallback(async () => {
    setLoading(true);
    setStatus('');
    try {
      const res = await fetch(`/api/public/comments?pageType=music&pageSlug=${encodeURIComponent(coverId)}`);
      const payload = await res.json();
      if (!res.ok) {
        setStatus(payload?.error ?? 'Could not load comments.');
        setComments([]);
      } else {
        setComments(payload.comments ?? []);
      }
    } catch {
      setStatus('Could not load comments.');
      setComments([]);
    }
    setLikedIds(new Set());
    setLoading(false);
  }, [coverId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    const commentsChannel = supabase
      .channel(`cover-comments-${coverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `page_slug=eq.${coverId}` }, () => {
        void loadComments();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(commentsChannel);
    };
  }, [coverId, loadComments]);

  const submitComment = async () => {
    const trimmed = content.trim();
    if (!trimmed || !identity) return;
    if (!user) {
      openAuthModal('login');
      return;
    }

    setSubmitting(true);
    setStatus('');

    const res = await fetch('/api/public/comments', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        pageType: 'music',
        pageSlug: coverId,
        content: trimmed,
        sessionId: identity.sessionId,
        localStorageId: identity.localStorageId,
      }),
    });

    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload?.error ?? 'Could not post comment right now.');
    } else {
      setContent('');
      if (payload?.isShadowBanned) setStatus('Comment submitted.');
      await loadComments();
    }

    setSubmitting(false);
  };

  const toggleLike = async (commentId: string) => {
    if (!identity) return;
    if (!user) {
      openAuthModal('login');
      return;
    }

    const res = await fetch('/api/public/comments/like', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ commentId, sessionId: identity.sessionId, localStorageId: identity.localStorageId }),
    });
    if (!res.ok) {
      setStatus('Could not update like.');
      return;
    }

    const payload = await res.json();
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (payload.liked) next.add(commentId);
      else next.delete(commentId);
      return next;
    });
    setComments((prev) => prev.map((item) => (item.id === commentId ? { ...item, like_count: payload.likeCount } : item)));
  };

  const reportComment = async (commentId: string) => {
    if (!identity) return;
    if (!user) {
      openAuthModal('login');
      return;
    }

    const res = await fetch('/api/public/comments/report', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        commentId,
        reason: 'inappropriate',
        sessionId: identity.sessionId,
        localStorageId: identity.localStorageId,
      }),
    });

    const payload = await res.json();
    setStatus(res.ok ? 'Report sent. Thanks for helping keep the gallery clean.' : (payload?.error ?? 'Could not submit report.'));
  };

  return (
    <section className="cover-comments">
      <h3 className="cover-comments-title"><MessageCircle size={14} /> Comments</h3>

      {!user && <p className="cover-comments-muted">Sign in to comment, like, and report.</p>}

      <div className="cover-comments-composer">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="cover-comments-input"
          placeholder={user ? 'Add a comment to this cover...' : 'Sign in to comment...'}
          maxLength={5000}
          disabled={!user}
        />
        <button className="btn btn-primary" onClick={submitComment} disabled={!user || submitting || !content.trim()}>
          {submitting ? <><Loader size={13} className="upload-spinner" /> Posting…</> : 'Post comment'}
        </button>
      </div>

      {status && <p className="cover-comments-status">{status}</p>}

      {loading ? (
        <p className="cover-comments-muted">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="cover-comments-muted">No comments yet. Start the convo.</p>
      ) : (
        <ul className="cover-comments-list">
          {comments.map((comment) => (
            <li key={comment.id} className="cover-comment-item">
              <div className="cover-comment-top">
                <strong>{comment.author_username}</strong>
                <span>{new Date(comment.created_at).toLocaleString()}</span>
              </div>
              <p className="cover-comment-body">{comment.content}</p>
              <div className="cover-comment-actions">
                <button className="cover-comment-action" onClick={() => toggleLike(comment.id)}>
                  <Heart size={12} fill={likedIds.has(comment.id) ? 'currentColor' : 'none'} />
                  {comment.like_count ?? 0}
                </button>
                <button className="cover-comment-action" onClick={() => reportComment(comment.id)}>
                  <Flag size={12} /> Report
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
