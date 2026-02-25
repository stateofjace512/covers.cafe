import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UserIcon from '../components/UserIcon';
import BackIcon from '../components/BackIcon';
import GalleryIcon from '../components/GalleryIcon';
import FolderIcon from '../components/FolderIcon';
import LockIcon from '../components/LockIcon';
import GearIcon from '../components/GearIcon';
import PinIcon from '../components/PinIcon';
import CoffeeCupIcon from '../components/CoffeeCupIcon';
import FavoritesIcon from '../components/FavoritesIcon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import GalleryGrid from '../components/GalleryGrid';
import AchievementBadges from '../components/AchievementBadges';
import type { Profile, Cover } from '../lib/types';
import { getAvatarSrc, getCoverImageSrc } from '../lib/media';
import { getCoverPath } from '../lib/coverRoutes';

// ── Theme helpers ─────────────────────────────────────────────────────────────

function parseHex(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const c = (x: number) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

function bannerStyleFromProfile(profile: Profile): React.CSSProperties {
  const theme = profile.profile_theme;
  if (!theme) return {};
  if (theme === 'gradient' && profile.profile_gradient_start && profile.profile_gradient_end) {
    const rgb = parseHex(profile.profile_gradient_start);
    const lum = rgb ? relativeLuminance(...rgb) : 0.5;
    const textColor = lum > 0.179 ? '#000000' : '#ffffff';
    return {
      background: `linear-gradient(135deg, ${profile.profile_gradient_start} 0%, ${profile.profile_gradient_end} 100%)`,
      color: textColor,
    };
  }
  const presets: Record<string, React.CSSProperties> = {
    light:      { background: '#f5e6d3', color: '#3d1a05' },
    dark:       { background: '#3d1a05', color: '#f0c890' },
    pureblack:  { background: '#111111', color: '#ffffff' },
    crisp:      { background: '#f0f0f0', color: '#111111' },
  };
  return presets[theme] ?? {};
}

// ── Pinned covers ─────────────────────────────────────────────────────────────

interface PinnedRow {
  id: string;
  cover_id: string;
  position: number;
  covers_cafe_covers: Pick<Cover, 'id' | 'title' | 'artist' | 'storage_path' | 'image_url' | 'page_slug'> | null;
}

export default function ArtistDetail() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user, session, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [coverCount, setCoverCount] = useState(0);
  const [brews, setBrews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);
  const [pinnedCovers, setPinnedCovers] = useState<PinnedRow[]>([]);
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
      setProfile(profileData as Profile);

      // Cover count
      const { count } = await supabase
        .from('covers_cafe_covers')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profileData.id)
        .eq('is_public', true);
      setCoverCount(count ?? 0);

      // Brews: sum of favorite_count + download_count across all public covers
      const { data: coverStats } = await supabase
        .from('covers_cafe_covers')
        .select('favorite_count, download_count')
        .eq('user_id', profileData.id)
        .eq('is_public', true);
      const totalBrews = (coverStats ?? []).reduce(
        (acc: number, c: { favorite_count: number; download_count: number }) =>
          acc + (c.favorite_count ?? 0) + (c.download_count ?? 0),
        0,
      );
      setBrews(totalBrews);

      // Pinned covers
      const { data: pinned } = await supabase
        .from('covers_cafe_pinned_covers')
        .select('id, cover_id, position, covers_cafe_covers(id, title, artist, storage_path, image_url, page_slug)')
        .eq('user_id', profileData.id)
        .order('position', { ascending: true })
        .limit(6);
      setPinnedCovers((pinned ?? []) as PinnedRow[]);

      // Collections
      const isOwner = user?.id === profileData.id;
      let colQuery = supabase
        .from('covers_cafe_collections')
        .select('id,name,is_public,cover_image_id')
        .eq('owner_id', profileData.id)
        .order('created_at', { ascending: false });
      if (!isOwner) colQuery = colQuery.eq('is_public', true);
      const { data: colData, error: colError } = await colQuery;
      if (colError) console.error('Collections query error:', colError.message);

      const rows = (colData ?? []) as { id: string; name: string; is_public: boolean; cover_image_id: string | null }[];
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

      const coverImageMap: Record<string, { storage_path: string; image_url: string }> = {};
      const coverImageIds = rows.map((r) => r.cover_image_id).filter(Boolean) as string[];
      if (coverImageIds.length > 0) {
        const { data: coverImages } = await supabase
          .from('covers_cafe_covers')
          .select('id,storage_path,image_url')
          .in('id', coverImageIds);
        for (const c of coverImages ?? []) coverImageMap[c.id] = c;
      }

      const fallbackCoverMap: Record<string, { storage_path: string; image_url: string }> = {};
      const collectionsWithoutCover = rows.filter((r) => !r.cover_image_id).map((r) => r.id);
      if (collectionsWithoutCover.length > 0) {
        const { data: sampleItems } = await supabase
          .from('covers_cafe_collection_items')
          .select('collection_id, covers_cafe_covers(storage_path, image_url)')
          .in('collection_id', collectionsWithoutCover)
          .order('created_at', { ascending: false });
        for (const item of (sampleItems ?? []) as Array<{ collection_id: string; covers_cafe_covers: { storage_path: string; image_url: string } | null }>) {
          if (!fallbackCoverMap[item.collection_id] && item.covers_cafe_covers)
            fallbackCoverMap[item.collection_id] = item.covers_cafe_covers;
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
      const followRes = await fetch('/api/follow?userId=' + profileData.id);
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
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ userId: profile.id, follow: next }),
      });
    } catch {
      setFollowing(!next);
      setFollowerCount((c) => c + (next ? -1 : 1));
    }
    setFollowBusy(false);
  }

  async function togglePin(coverId: string, currentlyPinned: boolean) {
    if (!session?.access_token) return;
    const action = currentlyPinned ? 'unpin' : 'pin';
    const res = await fetch('/api/pin-cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ cover_id: coverId, action }),
    });
    if (!res.ok) return;
    if (action === 'unpin') {
      setPinnedCovers((prev) => prev.filter((p) => p.cover_id !== coverId));
    }
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
  const bannerStyle = profile ? bannerStyleFromProfile(profile) : {};
  const hasBanner = profile?.banner_url || profile?.profile_theme;

  return (
    <div>
      <button className="btn btn-secondary artist-back-btn" onClick={() => navigate('/users')}>
        <BackIcon size={14} /> All Users
      </button>

      <div className="artist-detail-header card" style={hasBanner && !profile?.banner_url ? bannerStyle : undefined}>
        {/* Banner image */}
        {profile?.banner_url && (
          <div
            className="artist-profile-banner"
            style={{ backgroundImage: 'url(' + profile.banner_url + ')', ...bannerStyle }}
          />
        )}
        {!profile?.banner_url && hasBanner && (
          <div className="artist-profile-banner artist-profile-banner--theme" style={bannerStyle} />
        )}

        <div className="artist-detail-body">
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
              <a href={profile.website} className="artist-detail-website" target="_blank" rel="noopener noreferrer">
                {profile.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            <p className="artist-detail-count">
              {coverCount} cover{coverCount !== 1 ? 's' : ''}
              {followerCount > 0 && <> · {followerCount} follower{followerCount !== 1 ? 's' : ''}</>}
              {brews > 0 && (
                <span className="artist-detail-brews">
                  · <CoffeeCupIcon size={12} /> {brews} Brew{brews !== 1 ? 's' : ''}
                </span>
              )}
            </p>
            <div className="artist-detail-actions">
              {isOwnProfile && (
                <button className="btn btn-secondary artist-edit-btn" onClick={() => navigate('/profile/edit')}>
                  <GearIcon size={13} /> Edit Profile
                </button>
              )}
              {user && !isOwnProfile && (
                <button
                  className={'btn' + (following ? '' : ' btn-primary') + ' artist-follow-btn'}
                  onClick={toggleFollow}
                  disabled={followBusy}
                >
                  {following ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      {profile && <AchievementBadges userId={profile.id} />}

      {/* Pinned Covers */}
      {(pinnedCovers.length > 0 || isOwnProfile) && (
        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">
            <PinIcon size={18} />
            Pinned
          </h2>
          {pinnedCovers.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 17 }}>No pinned covers yet. Pin up to 6 from your gallery.</p>
          ) : (
            <div className="pinned-grid">
              {pinnedCovers.map((p) => {
                const c = p.covers_cafe_covers;
                if (!c) return null;
                return (
                  <div key={p.id} className="pinned-card">
                    <button
                      className="pinned-img-btn"
                      onClick={() => navigate(getCoverPath(c as Cover))}
                      title={c.title + ' by ' + c.artist}
                    >
                      <img
                        src={getCoverImageSrc(c as Cover, 300)}
                        alt={c.title}
                        className="pinned-img"
                        loading="lazy"
                      />
                      <div className="pinned-overlay">
                        <PinIcon size={14} />
                      </div>
                    </button>
                    <div className="pinned-info">
                      <span className="pinned-title">{c.title}</span>
                      <span className="pinned-artist">{c.artist}</span>
                    </div>
                    {isOwnProfile && (
                      <button
                        className="pinned-remove-btn"
                        title="Unpin"
                        onClick={() => togglePin(c.id, true)}
                      >×</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Collections */}
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
                onClick={() => navigate('/users/' + username + '/collections/' + collection.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate('/users/' + username + '/collections/' + collection.id)}
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
