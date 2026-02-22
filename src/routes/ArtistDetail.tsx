import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserRound, ArrowLeft, Image, Folder, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import GalleryGrid from '../components/GalleryGrid';
import type { Profile } from '../lib/types';
import { getAvatarSrc, getCoverImageSrc } from '../lib/media';

export default function ArtistDetail() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [coverCount, setCoverCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [collections, setCollections] = useState<{
    id: string;
    name: string;
    is_public: boolean;
    item_count: number;
    cover_image: { storage_path: string; image_url: string; thumbnail_path: string | null } | null;
  }[]>([]);

  useEffect(() => {
    if (!username) return;
    (async () => {
      const { data: profileData } = await supabase
        .from('covers_cafe_profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (!profileData) { setNotFound(true); setLoading(false); return; }
      setProfile(profileData);

      const { count } = await supabase
        .from('covers_cafe_covers')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profileData.id)
        .eq('is_public', true);
      setCoverCount(count ?? 0);

      const isOwner = user?.id === profileData.id;
      let colQuery = supabase
        .from('covers_cafe_collections')
        .select('id,name,is_public,cover_image_id')
        .eq('owner_id', profileData.id)
        .order('created_at', { ascending: false });
      if (!isOwner) colQuery = colQuery.eq('is_public', true);
      const { data: colData, error: colError } = await colQuery;

      if (colError) {
        console.error('Collections query error:', colError.message);
      }

      const rows = (colData ?? []) as { id: string; name: string; is_public: boolean; cover_image_id: string | null }[];

      // Fetch item counts separately to avoid RLS interaction via embedding.
      const collectionIds = rows.map((r) => r.id);
      const itemCountMap: Record<string, number> = {};
      if (collectionIds.length > 0) {
        const { data: itemRows } = await supabase
          .from('covers_cafe_collection_items')
          .select('collection_id')
          .in('collection_id', collectionIds);
        for (const r of itemRows ?? []) {
          itemCountMap[r.collection_id] = (itemCountMap[r.collection_id] ?? 0) + 1;
        }
      }

      // Fetch cover image data for collections that have one set.
      const coverImageMap: Record<string, { storage_path: string; image_url: string; thumbnail_path: string | null }> = {};
      const coverImageIds = rows.map((r) => r.cover_image_id).filter(Boolean) as string[];
      if (coverImageIds.length > 0) {
        const { data: coverImages } = await supabase
          .from('covers_cafe_covers')
          .select('id,storage_path,image_url,thumbnail_path')
          .in('id', coverImageIds);
        for (const c of coverImages ?? []) {
          coverImageMap[c.id] = c;
        }
      }

      setCollections(rows.map((row) => ({
        id: row.id,
        name: row.name,
        is_public: row.is_public,
        cover_image: row.cover_image_id ? (coverImageMap[row.cover_image_id] ?? null) : null,
        item_count: itemCountMap[row.id] ?? 0,
      })));

      setLoading(false);
    })();
  }, [username, user?.id]);

  if (loading) return <p className="text-muted">Loading…</p>;
  if (notFound) return (
    <div>
      <button className="btn btn-secondary" style={{ marginBottom: 20 }} onClick={() => navigate('/users')}>
        <ArrowLeft size={14} /> Back to Users
      </button>
      <p className="text-muted">Artist not found.</p>
    </div>
  );

  const isOwnProfile = user?.id === profile?.id;

  return (
    <div>
      <button className="btn btn-secondary artist-back-btn" onClick={() => navigate('/users')}>
        <ArrowLeft size={14} /> All Users
      </button>

      <div className="artist-detail-header card">
        <div className="artist-detail-avatar">
          {profile && getAvatarSrc(profile)
            ? <img src={getAvatarSrc(profile)!} alt={profile.display_name ?? profile.username} className="artist-detail-avatar-img" />
            : <UserRound size={40} style={{ opacity: 0.3 }} />
          }
        </div>
        <div className="artist-detail-info">
          <h1 className="artist-detail-name">
            {profile?.display_name ?? profile?.username}
            {isOwnProfile && <span className="artist-detail-you">you</span>}
          </h1>
          {profile?.display_name && (
            <p className="artist-detail-username">@{profile.username}</p>
          )}
          {profile?.bio && <p className="artist-detail-bio">{profile.bio}</p>}
          {profile?.website && (
            <a
              href={profile.website}
              className="artist-detail-website"
              target="_blank"
              rel="noopener noreferrer"
            >
              {profile.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          <p className="artist-detail-count">
            {coverCount} cover{coverCount !== 1 ? 's' : ''} uploaded
          </p>
        </div>
      </div>


      <section style={{ marginTop: 24 }}>
        <h2 className="section-title">
          <Folder size={18} />
          {isOwnProfile ? 'My Collections' : 'Collections'}
        </h2>
        {collections.length === 0 ? (
          <p className="text-muted">{isOwnProfile ? 'You have no collections yet.' : 'No public collections yet.'}</p>
        ) : (
          <div className="artist-collection-grid">
            {collections.map((collection) => (
              <div
                key={collection.id}
                className="artist-collection-card card"
                onClick={() => navigate(`/users/${username}/collections/${collection.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/users/${username}/collections/${collection.id}`)}
              >
                <div className="artist-collection-thumb">
                  {collection.cover_image ? (
                    <img
                      src={getCoverImageSrc(collection.cover_image, 300)}
                      alt={collection.name}
                      className="artist-collection-thumb-img"
                    />
                  ) : (
                    <div className="artist-collection-thumb-empty">
                      <Folder size={24} style={{ opacity: 0.3 }} />
                    </div>
                  )}
                </div>
                <div className="artist-collection-info">
                  <div className="artist-collection-name">
                    {collection.name}
                    {!collection.is_public && (
                      <span className="artist-collection-private"><Lock size={10} /> Private</span>
                    )}
                  </div>
                  <div className="artist-collection-count">{collection.item_count} item{collection.item_count !== 1 ? 's' : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 className="section-title">
          <Image size={18} />
          Covers by {profile?.display_name ?? profile?.username}
        </h2>
        {profile && <GalleryGrid filter="artist" artistUserId={profile.id} />}
      </section>

      <style>{`
        .artist-back-btn { display: flex; align-items: center; gap: 6px; margin-bottom: 20px; }
        .artist-detail-header {
          display: flex; align-items: flex-start; gap: 20px;
          padding: 24px;
        }
        .artist-detail-avatar {
          width: 80px; height: 80px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(145deg, var(--sidebar-bg-light), var(--sidebar-bg-dark));
          border: 2px solid var(--body-card-border);
          box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
          color: var(--body-text-muted); overflow: hidden;
        }
        .artist-detail-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .artist-detail-info { display: flex; flex-direction: column; gap: 5px; }
        .artist-detail-name {
          font-size: 22px; font-weight: bold; color: var(--body-text);
          display: flex; align-items: center; gap: 10px;
          text-shadow: 0 1px 0 rgba(255,255,255,0.4);
        }
        [data-theme="dark"] .artist-detail-name { text-shadow: none; }
        .artist-detail-you {
          font-size: 11px; font-weight: bold; background: var(--accent);
          color: white; padding: 2px 7px; border-radius: 10px; letter-spacing: 0.3px;
        }
        .artist-detail-username { font-size: 13px; color: var(--body-text-muted); }
        .artist-detail-bio { font-size: 14px; color: var(--body-text); max-width: 480px; line-height: 1.5; }
        .artist-detail-website { font-size: 13px; color: var(--accent); text-decoration: none; }
        .artist-detail-website:hover { text-decoration: underline; }
        .artist-detail-count { font-size: 13px; color: var(--body-text-muted); margin-top: 4px; }
        .artist-collection-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
        .artist-collection-card { padding: 0; overflow: hidden; cursor: pointer; transition: transform 0.1s, box-shadow 0.1s; }
        .artist-collection-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .artist-collection-thumb { width: 100%; aspect-ratio: 1; background: var(--sidebar-bg); display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .artist-collection-thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .artist-collection-thumb-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--body-text-muted); }
        .artist-collection-info { padding: 10px 12px; }
        .artist-collection-name { font-size: 13px; font-weight: bold; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .artist-collection-private { font-size: 10px; font-weight: bold; color: var(--body-text-muted); background: var(--body-border); padding: 1px 6px; border-radius: 8px; display: flex; align-items: center; gap: 3px; white-space: nowrap; }
        .artist-collection-count { font-size: 12px; color: var(--body-text-muted); margin-top: 3px; }
      `}</style>
    </div>
  );
}
