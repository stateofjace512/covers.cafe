import { useCallback, useEffect, useMemo, useState } from 'react';
import CommentIcon from './CommentIcon';
import HeartIcon from './HeartIcon';
import FlagIcon from './FlagIcon';
import LoadingIcon from './LoadingIcon';
import TrashIcon from './TrashIcon';
import PencilIcon from './PencilIcon';
import CheckIcon from './CheckIcon';
import XIcon from './XIcon';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getClientIdentity } from '../lib/comments/identityTracking.client';
import { supabase } from '../lib/supabase';
import type { Cover } from '../lib/types';

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
  author_username: string;
  user_id?: string | null;
  like_count: number | null;
}

interface Props {
  coverId: string;
  cover?: Cover | null;
}

export default function CoverComments({ coverId, cover }: Props) {
  const { user, profile, session, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isOperator, setIsOperator] = useState(false);

  const identity = useMemo(() => (typeof window === 'undefined' ? null : getClientIdentity()), []);

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    }),
    [session?.access_token],
  );

  const currentAuthorName = user ? (profile?.username ?? user.email?.split('@')[0] ?? user.id.slice(0, 8)) : null;

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

  // Operator check
  useEffect(() => {
    let active = true;
    async function checkOperator() {
      if (!user) { setIsOperator(false); return; }
      const { data } = await supabase
        .from('covers_cafe_operator_roles')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('role', 'operator')
        .maybeSingle();
      if (active) setIsOperator(Boolean(data));
    }
    void checkOperator();
    return () => { active = false; };
  }, [user]);


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
    <section className="cc-section">
      <h3 className="cc-heading">
        <CommentIcon size={15} />
        Comments
        {comments.length > 0 && <span className="cc-count">{comments.length}</span>}
      </h3>

      {/* Composer */}
      <div className="cc-composer">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="cc-textarea"
          placeholder={user ? `Comment as @${currentAuthorName ?? '…'}` : 'Sign in to comment…'}
          maxLength={5000}
          disabled={!user}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submitComment();
          }}
        />
        <div className="cc-composer-footer">
          {!user && (
            <button className="cc-signin-prompt" onClick={() => openAuthModal('login')}>
              Sign in to join the conversation
            </button>
          )}
          <button
            className="btn btn-primary cc-post-btn"
            onClick={submitComment}
            disabled={!user || submitting || !content.trim()}
          >
            {submitting ? <><LoadingIcon size={13} className="upload-spinner" /> Posting…</> : 'Post'}
          </button>
        </div>
      </div>

      {status && <p className="cc-status">{status}</p>}

      {/* Comment list */}
      {loading ? (
        <p className="cc-empty"><LoadingIcon size={14} className="upload-spinner" /> Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="cc-empty">No comments yet, be the first!</p>
      ) : (
        <ul className="cc-list">
          {comments.map((comment) => (
            <li key={comment.id} className="cc-item">
              <div className="cc-item-header">
                <button
                  className="cc-author"
                  onClick={() => navigate(`/users/${comment.author_username}`)}
                >
                  @{comment.author_username}
                </button>
                <span className="cc-date" title={formatDateTooltip(comment.created_at)}>
                  {formatDate(comment.created_at)}
                </span>
              </div>

              {editingId === comment.id ? (
                <div className="cc-edit-wrap">
                  <textarea
                    className="cc-textarea"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    maxLength={5000}
                    rows={3}
                  />
                  <div className="cc-actions">
                    <button className="cc-action" onClick={() => saveEdit(comment.id)} disabled={editSaving || !editContent.trim()}>
                      <CheckIcon size={12} /> {editSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button className="cc-action" onClick={cancelEdit}><XIcon size={12} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="cc-body">{comment.content}</p>
                  {comment.edited_at && (
                    <p className="cc-edited" title={formatDateTooltip(comment.edited_at)}>
                      edited {formatDate(comment.edited_at)}
                    </p>
                  )}
                  <div className="cc-actions">
                    <button
                      className={`cc-action${likedIds.has(comment.id) ? ' cc-action--liked' : ''}`}
                      onClick={() => toggleLike(comment.id)}
                    >
                      <HeartIcon size={12} />
                      {comment.like_count ?? 0}
                    </button>
                    <button className="cc-action" onClick={() => reportComment(comment.id)}>
                      <FlagIcon size={12} /> Report
                    </button>
                    {currentAuthorName && comment.author_username === currentAuthorName && (
                      <button className="cc-action" onClick={() => startEdit(comment)}>
                        <PencilIcon size={12} /> Edit
                      </button>
                    )}
                    {(currentAuthorName && comment.author_username === currentAuthorName || isOperator) && (
                      <button
                        className={`cc-action cc-action--delete${deleteConfirmId === comment.id ? ' cc-action--delete-confirm' : ''}`}
                        onClick={() => {
                          if (deleteConfirmId === comment.id) {
                            void deleteComment(comment.id);
                            setDeleteConfirmId(null);
                          } else {
                            setDeleteConfirmId(comment.id);
                          }
                        }}
                        onMouseLeave={() => { if (deleteConfirmId === comment.id) setDeleteConfirmId(null); }}
                      >
                        <TrashIcon size={12} /> {deleteConfirmId === comment.id ? 'Confirm?' : 'Delete'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <style>{`
        .cc-section {
          margin-top: 28px;
          padding-top: 22px;
          border-top: 2px solid var(--body-border);
        }

        .cc-heading {
          font-size: 19px;
          color: var(--body-text);
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 14px;
        }

        [data-theme="dark"] .cc-heading { }

        .cc-count {
          background: var(--accent);
          color: var(--accent-text);
          font-size: 17px;
          padding: 1px 7px;
          border-radius: 10px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.25);
        }

        .cc-composer {
          background: var(--body-card-bg);
          border: 1px solid var(--body-card-border);
          border-radius: 7px;
          box-shadow: var(--shadow-inset-sm);
          overflow: hidden;
          margin-bottom: 16px;
        }

        .cc-textarea {
          width: 100%;
          border: none;
          background: transparent;
          padding: 12px 14px;
          font-size: 19px;
          color: var(--body-text);
          outline: none;
          box-shadow: none;
          resize: none;
          font-family: var(--font-body);
          line-height: 1.5;
        }

        .cc-textarea:focus { box-shadow: none; border-color: transparent; }

        .cc-composer-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 8px 12px;
          border-top: 1px solid var(--body-border);
          background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 100%);
        }

        .cc-signin-prompt {
          background: none;
          border: none;
          font-size: 18px;
          color: var(--accent);
          cursor: pointer;
          padding: 0;
          box-shadow: none;
          font-family: var(--font-body);
          margin-right: auto;
        }

        .cc-signin-prompt:hover { text-decoration: underline; }

        .cc-post-btn { font-size: 19px; padding: 5px 14px; }

        .cc-status {
          font-size: 19px;
          color: var(--body-text-muted);
          margin-bottom: 12px;
          padding: 8px 12px;
          background: var(--body-card-bg);
          border: 1px solid var(--body-border);
          border-radius: 5px;
        }

        .cc-empty {
          font-size: 19px;
          color: var(--body-text-muted);
          padding: 20px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .cc-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .cc-item {
          background: var(--body-card-bg);
          border: 1px solid var(--body-card-border);
          border-radius: 7px;
          box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.35);
          padding: 12px 14px;
          background-image: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 40%);
        }

        .cc-item-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 7px;
        }

        .cc-author {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 19px;
          color: var(--accent);
          padding: 0;
          box-shadow: none;
          font-family: var(--font-body);
          letter-spacing: 0.2px;
        }

        .cc-author:hover { color: var(--accent-light); text-decoration: underline; }

        .cc-date {
          font-size: 17px;
          color: var(--body-text-muted);
          margin-left: auto;
        }

        .cc-body {
          font-size: 20px;
          color: var(--body-text);
          line-height: 1.55;
          word-break: break-word;
          margin-bottom: 8px;
          white-space: pre-wrap;
        }

        .cc-edited {
          font-size: 17px;
          color: var(--body-text-muted);
          font-style: italic;
          margin-bottom: 8px;
        }

        .cc-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 6px;
        }

        .cc-edit-wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .cc-edit-wrap .cc-textarea {
          border: 1px solid var(--body-card-border);
          border-radius: 5px;
          box-shadow: var(--shadow-inset-sm);
          padding: 8px 10px;
        }

        .cc-action {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: none;
          border: 1px solid var(--body-border);
          border-radius: 4px;
          padding: 3px 8px;
          font-size: 17px;
          color: var(--body-text-muted);
          cursor: pointer;
          font-family: var(--font-body);
          box-shadow: none;
          transition: background 0.1s, color 0.1s;
        }

        .cc-action:hover {
          background: var(--body-border);
          color: var(--body-text);
        }

        .cc-action--liked {
          color: var(--accent);
          border-color: var(--accent);
        }

        .cc-action--liked:hover {
          background: rgba(192, 90, 26, 0.12);
          color: var(--accent);
        }

        .cc-action--delete:hover {
          background: rgba(180, 40, 20, 0.1);
          color: #c0392b;
          border-color: #c0392b;
        }

        .cc-action--delete-confirm {
          background: #c83220 !important;
          color: white !important;
          border-color: #a02010 !important;
        }
        .cc-action--delete-confirm:hover {
          background: #a02010 !important;
          color: white !important;
        }


      `}</style>
    </section>
  );
}
