import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  body: string;
  author_username: string | null;
  published_at: string;
  created_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/blog/posts?slug=${encodeURIComponent(slug)}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setPost(data as BlogPost);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="route-container">
        <p style={{ color: 'var(--body-text-muted)', fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="route-container">
        <p style={{ color: 'var(--body-text-muted)', fontSize: 14 }}>Post not found.</p>
        <Link to="/blog" className="btn" style={{ marginTop: 12 }}>← Back to Blog</Link>
      </div>
    );
  }

  return (
    <div className="route-container">
      <div className="blog-post">
        <Link to="/blog" className="blog-back">← Blog</Link>
        <h1 className="blog-post-title">{post.title}</h1>
        <p className="blog-post-meta">
          {post.author_username ? `by @${post.author_username} · ` : ''}
          {formatDate(post.published_at)}
        </p>
        <div className="blog-post-body">
          {post.body.split('\n').map((line, i) =>
            line.trim() === '' ? <br key={i} /> : <p key={i}>{line}</p>
          )}
        </div>
      </div>
    </div>
  );
}
