import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UserIcon from '../components/UserIcon';
import BackIcon from '../components/BackIcon';
import GalleryIcon from '../components/GalleryIcon';
import FolderIcon from '../components/FolderIcon';
import LockIcon from '../components/LockIcon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import GalleryGrid from '../components/GalleryGrid';
import AchievementBadges from '../components/AchievementBadges';
import type { Profile } from '../lib/types';
import { getAvatarSrc, getCoverImageSrc } from '../lib/media';

export default function ArtistDetail() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user, session, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [coverCount, setCoverCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);
  const [collections, setCollections] = useState<{
    id: string;
    name: string;
    is_public: boolean;
    item_count: number;
    cover_image: { storage_path: string; image_url: string } | null;
  }[]>([]);

  useEffect(() => {
    if (!username || authLoading) return;
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
      const coverImageMap: Record<string, { storage_path: string; image_url: string }> = {};
      const coverImageIds = rows.map((r) => r.cover_image_id).filter(Boolean) as string[];
      if (coverImageIds.length > 0) {
        const { data: coverImages } = await supabase
          .from('covers_cafe_covers')
          .select('id,storage_path,image_url')
          .in('id', coverImageIds);
        for (const c of coverImages ?? []) {
          coverImageMap[c.id] = c;
        }
      }

      // For collections without a custom cover, fall back to the first item's cover art.
      const fallbackCoverMap: Record<string, { storage_path: string; image_url: string }> = {};
      const collectionsWithoutCover = rows.filter((r) => !r.cover_image_id).map((r) => r.id);
      if (collectionsWithoutCover.length > 0) {
        const { data: sampleItems } = await supabase
          .from('covers_cafe_collection_items')
          .select('collection_id, covers_cafe_covers(storage_path, image_url)')
          .in('collection_id', collectionsWithoutCover)
          .order('created_at', { ascending: false });
        for (const item of (sampleItems ?? []) as Array<{ collection_id: string; covers_cafe_covers: { storage_path: string; image_url: string } | null }>) {
          if (!fallbackCoverMap[item.collection_id] && item.covers_cafe_covers) {
            fallbackCoverMap[item.collection_id] = item.covers_cafe_covers;
          }
        }
      }

      setCollections(rows.map((row) => ({
        id: row.id,
        name: row.name,
        is_public: row.is_public,
        cover_image: row.cover_image_id
          ? (coverImageMap[row.cover_image_id] ?? null)
          : (fallbackCoverMap[row.id] ?? null),
        item_count: itemCountMap[row.id] ?? 0,
      })));

      // Follow status
      const followRes = await fetch(`/api/follow?userId=${profileData.id}`);
      if (followRes.ok) {
        const followData = await followRes.json() as { following: boolean; followerCount: number };
        setFollowing(followData.following);
        setFollowerCount(followData.followerCount);
      }

      setLoading(false);
    })();
  }, [username, user?.id, authLoading]);

  async function toggleFollow() {
    if (!profile || !session?.access_token) return;
    setFollowBusy(true);
    const next = !following;
    setFollowing(next);
    setFollowerCount((c) => c + (next ? 1 : -1));
    try {
      await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: profile.id, follow: next }),
      });
    } catch {
      // revert on error
      setFollowing(!next);
      setFollowerCount((c) => c + (next ? -1 : 1));
    }
    setFollowBusy(false);
  }

  if (loading) return <p className="text-muted">Loading…</p>;
  if (notFound) return (
    <div>
      <button className="btn btn-secondary" style={{ marginBottom: 20 }} onClick={() => navigate('/users')}>
        <BackIcon size={14} /> Back to Artists
      </button>
      <p className="text-muted">Artist not found.</p>
    </div>
  );

  const isOwnProfile = user?.id === profile?.id;

  return (
    <div>
      <button className="btn btn-secondary artist-back-btn" onClick={() => navigate('/users')}>
        <BackIcon size={14} /> All Users
      </button>

      <div className="artist-detail-header card">
        <div className="artist-detail-avatar">
          {profile && getAvatarSrc(profile)
            ? <img src={getAvatarSrc(profile)!} alt={profile.display_name ?? profile.username} className="artist-detail-avatar-img" loading="lazy" />
            : <UserIcon size={40} style={{ opacity: 0.3 }} />
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
            {followerCount > 0 && <> · {followerCount} follower{followerCount !== 1 ? 's' : ''}</>}
          </p>
          {user && !isOwnProfile && (
            <button
              className={`btn${following ? '' : ' btn-primary'} artist-follow-btn`}
              onClick={toggleFollow}
              disabled={followBusy}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </div>

      {/* Achievements */}
      {profile && <AchievementBadges userId={profile.id} />}

      <section style={{ marginTop: 24 }}>
        <h2 className="section-title">
          <FolderIcon size={18} />
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
                      src={getCoverImageSrc(collection.cover_image, 500)}
                      alt={collection.name}
                      className="artist-collection-thumb-img"
                      loading="lazy"
                    />
                  ) : (
                    <div className="artist-collection-thumb-empty">
                      <FolderIcon size={24} style={{ opacity: 0.3 }} />
                    </div>
                  )}
                </div>
                <div className="artist-collection-info">
                  <div className="artist-collection-name">
                    {collection.name}
                    {!collection.is_public && (
                      <span className="artist-collection-private"><LockIcon size={10} /> Private</span>
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
          <GalleryIcon size={18} />
          Covers by {profile?.username}
        </h2>
        {profile && <GalleryGrid filter="artist" artistUserId={profile.id} />}
      </section>

      
    </div>
  );
}
