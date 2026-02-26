import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

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

function excerpt(body: string, max = 200): string {
  const trimmed = body.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/blog/posts')
      .then((r) => r.json())
      .then((data) => { setPosts(data as BlogPost[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="route-container">
      <h1 className="route-title">Blog</h1>

      {loading ? (
        <p style={{ color: 'var(--body-text-muted)', fontSize: 14 }}>Loading…</p>
      ) : posts.length === 0 ? (
        <p style={{ color: 'var(--body-text-muted)', fontSize: 14 }}>No posts yet.</p>
      ) : (
        <div className="blog-list">
          {posts.map((post) => (
            <Link key={post.id} to={`/blog/${post.slug}`} className="blog-card">
              <h2 className="blog-card-title">{post.title}</h2>
              <p className="blog-card-meta">
                {post.author_username ? `by @${post.author_username} · ` : ''}
                {formatDate(post.published_at)}
              </p>
              <p className="blog-card-excerpt">{excerpt(post.body)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
