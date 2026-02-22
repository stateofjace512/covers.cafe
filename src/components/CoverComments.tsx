import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Heart, Flag, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  author_username: string;
  identity_hash: string;
  like_count: number | null;
}

interface Props {
  coverId: string;
}

const ANON_KEY = 'covers_cafe_comment_anon_key';

function getAnonIdentity() {
  let key = localStorage.getItem(ANON_KEY);
  if (!key) {
    key = `anon_${crypto.randomUUID()}`;
    localStorage.setItem(ANON_KEY, key);
  }
  return key;
}

export default function CoverComments({ coverId }: Props) {
  const { user, openAuthModal } = useAuth();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const identityHash = useMemo(() => (typeof window === 'undefined' ? '' : (user?.id ?? getAnonIdentity())), [user?.id]);

  const loadComments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('comments')
      .select('id, content, created_at, author_username, identity_hash, like_count, is_shadow_banned')
      .eq('page_type', 'music')
      .eq('page_slug', coverId)
      .eq('is_shadow_banned', false)
      .order('created_at', { ascending: false });

    setComments((data as CommentRow[]) ?? []);

    if (identityHash) {
      const { data: likes } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('identity_hash', identityHash)
        .in('comment_id', ((data as CommentRow[]) ?? []).map((item) => item.id));

      setLikedIds(new Set((likes ?? []).map((item: { comment_id: string }) => item.comment_id)));
    }

    setLoading(false);
  }, [coverId, identityHash]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const submitComment = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setStatus('');

    const authorName = user?.email?.split('@')[0] ?? `anon-${identityHash.slice(0, 8)}`;

    const { error } = await supabase.from('comments').insert({
      page_type: 'music',
      page_slug: coverId,
      content: trimmed,
      parent_comment_id: null,
      author_username: authorName,
      identity_hash: identityHash,
      like_count: 0,
    });

    if (error) {
      setStatus('Could not post comment right now.');
    } else {
      setContent('');
      await loadComments();
    }

    setSubmitting(false);
  };

  const toggleLike = async (commentId: string) => {
    if (!identityHash) return;

    const liked = likedIds.has(commentId);
    if (liked) {
      await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('identity_hash', identityHash);
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, identity_hash: identityHash });
    }

    await loadComments();
  };

  const reportComment = async (commentId: string) => {
    if (!user) {
      openAuthModal('login');
      return;
    }

    await supabase.from('comment_reports').insert({
      comment_id: commentId,
      reporter_identity_hash: identityHash,
      reason: 'inappropriate',
    });

    setStatus('Report sent. Thanks for helping keep the gallery clean.');
  };

  return (
    <section className="cover-comments">
      <h3 className="cover-comments-title"><MessageCircle size={14} /> Comments</h3>

      <div className="cover-comments-composer">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="cover-comments-input"
          placeholder="Add a comment to this cover..."
          maxLength={5000}
        />
        <button className="btn btn-primary" onClick={submitComment} disabled={submitting || !content.trim()}>
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
