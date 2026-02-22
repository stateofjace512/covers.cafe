import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Heart, Flag, Loader, Trash2, Pencil, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getClientIdentity } from '../lib/comments/identityTracking.client';
import { supabase } from '../lib/supabase';

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const identity = useMemo(() => (typeof window === 'undefined' ? null : getClientIdentity()), []);

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    }),
    [session?.access_token],
  );

  const currentAuthorName = user ? (user.email?.split('@')[0] ?? user.id.slice(0, 8)) : null;

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }).format(new Date(value));

  const formatDateTooltip = (value: string) =>
    new Date(value).toLocaleString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
    });

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
    if (!user) return openAuthModal('login');

    setSubmitting(true);
    setStatus('');
    const res = await fetch('/api/public/comments', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ pageType: 'music', pageSlug: coverId, content: trimmed, sessionId: identity.sessionId, localStorageId: identity.localStorageId }),
    });

    const payload = await res.json();
    if (!res.ok) setStatus(payload?.error ?? 'Could not post comment right now.');
    else {
      setContent('');
      if (payload?.isShadowBanned) setStatus('Comment submitted.');
      await loadComments();
    }
    setSubmitting(false);
  };

  const toggleLike = async (commentId: string) => {
    if (!identity) return;
    if (!user) return openAuthModal('login');

    const res = await fetch('/api/public/comments/like', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ commentId, sessionId: identity.sessionId, localStorageId: identity.localStorageId }),
    });
    if (!res.ok) return setStatus('Could not update like.');

    const payload = await res.json();
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (payload.liked) next.add(commentId); else next.delete(commentId);
      return next;
    });
    setComments((prev) => prev.map((item) => (item.id === commentId ? { ...item, like_count: payload.likeCount } : item)));
  };

  const reportComment = async (commentId: string) => {
    if (!identity) return;
    if (!user) return openAuthModal('login');

    const res = await fetch('/api/public/comments/report', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ commentId, reason: 'inappropriate', sessionId: identity.sessionId, localStorageId: identity.localStorageId }),
    });

    const payload = await res.json();
    setStatus(res.ok ? 'Report sent. Thanks for helping keep the gallery clean.' : (payload?.error ?? 'Could not submit report.'));
  };

  const deleteComment = async (commentId: string) => {
    if (!user) return openAuthModal('login');

    const res = await fetch('/api/public/comments/delete', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ commentId }),
    });

    const payload = await res.json();
    if (!res.ok) return setStatus(payload?.error ?? 'Could not delete comment.');

    setStatus('Comment deleted.');
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const startEdit = (comment: CommentRow) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const saveEdit = async (commentId: string) => {
    if (!user) return openAuthModal('login');
    const trimmed = editContent.trim();
    if (!trimmed) return setStatus('Comment cannot be empty.');

    setEditSaving(true);
    const res = await fetch('/api/public/comments/edit', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ commentId, content: trimmed }),
    });
    const payload = await res.json();
    if (!res.ok) setStatus(payload?.error ?? 'Could not edit comment.');
    else {
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, content: payload.comment.content, edited_at: payload.comment.edited_at } : c)));
      setStatus('Comment updated.');
      cancelEdit();
    }
    setEditSaving(false);
  };

  return (
    <section className="cover-comments">
      <h3 className="cover-comments-title"><MessageCircle size={14} /> Comments</h3>
      {!user && <p className="cover-comments-muted">Sign in to comment, like, report, edit, or delete your comments.</p>}

      <div className="cover-comments-composer">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} className="cover-comments-input" placeholder={user ? 'Add a comment to this cover...' : 'Sign in to comment...'} maxLength={5000} disabled={!user} />
        <button className="btn btn-primary" onClick={submitComment} disabled={!user || submitting || !content.trim()}>
          {submitting ? <><Loader size={13} className="upload-spinner" /> Posting…</> : 'Post comment'}
        </button>
      </div>

      {status && <p className="cover-comments-status">{status}</p>}

      {loading ? <p className="cover-comments-muted">Loading comments…</p> : comments.length === 0 ? <p className="cover-comments-muted">No comments yet. Start the convo.</p> : (
        <ul className="cover-comments-list">
          {comments.map((comment) => (
            <li key={comment.id} className="cover-comment-item">
              <div className="cover-comment-top">
                <strong>{comment.author_username}</strong>
                <span title={formatDateTooltip(comment.created_at)}>{formatDate(comment.created_at)}</span>
              </div>
              {editingId === comment.id ? (
                <div className="cover-comment-edit-wrap">
                  <textarea className="cover-comments-input" value={editContent} onChange={(e) => setEditContent(e.target.value)} maxLength={5000} />
                  <div className="cover-comment-actions">
                    <button className="cover-comment-action" onClick={() => saveEdit(comment.id)} disabled={editSaving || !editContent.trim()}>
                      <Check size={12} /> {editSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button className="cover-comment-action" onClick={cancelEdit}><X size={12} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="cover-comment-body">{comment.content}</p>
                  {comment.edited_at && <p className="cover-comment-edited" title={formatDateTooltip(comment.edited_at)}>edited {formatDate(comment.edited_at)}</p>}
                  <div className="cover-comment-actions">
                    <button className="cover-comment-action" onClick={() => toggleLike(comment.id)}><Heart size={12} fill={likedIds.has(comment.id) ? 'currentColor' : 'none'} />{comment.like_count ?? 0}</button>
                    <button className="cover-comment-action" onClick={() => reportComment(comment.id)}><Flag size={12} /> Report</button>
                    {currentAuthorName && comment.author_username === currentAuthorName && (
                      <>
                        <button className="cover-comment-action" onClick={() => startEdit(comment)}><Pencil size={12} /> Edit</button>
                        <button className="cover-comment-action cover-comment-action--delete" onClick={() => deleteComment(comment.id)}><Trash2 size={12} /> Delete</button>
                      </>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
