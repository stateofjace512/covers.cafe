import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppShell from './components/AppShell';
import AuthModal from './components/AuthModal';
import { applyUserPreferencesToDocument } from './lib/userPreferences';

// Route pages
import Gallery from './routes/Gallery';
import Upload from './routes/Upload';
import Artists from './routes/Artists';
import ArtistDetail from './routes/ArtistDetail';
import CollectionDetail from './routes/CollectionDetail';
import MusicArtists from './routes/MusicArtists';
import MusicArtistDetail from './routes/MusicArtistDetail';
import Favorites from './routes/Favorites';
import Downloads from './routes/Downloads';
import Profile from './routes/Profile';
import EditProfile from './routes/EditProfile';
import Settings from './routes/Settings';
import Coffee from './routes/Coffee';
import Privacy from './routes/Privacy';
import Terms from './routes/Terms';
import About from './routes/About';
import Cms from './routes/Cms';
import Acotw from './routes/Acotw';
import NotFound from './routes/NotFound';
import CoverDetail from './routes/CoverDetail';
import OfficialCoverDetail from './routes/OfficialCoverDetail';
import Friends from './routes/Friends';


interface SeoPayload {
  title: string;
  description: string;
}

const DEFAULT_SEO: SeoPayload = {
  title: 'covers.cafe | Upload and discover album cover art',
  description: 'Discover, upload, and share album cover art at covers.cafe. Browse artists, favorites, collections, and downloads in one place.',
};

function upsertMetaByName(name: string, content: string) {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertMetaByProperty(property: string, content: string) {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  if (typeof document === 'undefined') return;
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function getSeoForPath(pathname: string): SeoPayload {
  if (pathname === '/') return {
    title: 'covers.cafe | Home',
    description: 'Browse new, top rated, and trending album cover art. Search by title, artist, and tags on covers.cafe.',
  };
  if (pathname === '/upload') return {
    title: 'Upload Covers | covers.cafe',
    description: 'Upload album cover art, add tags, and publish your work for the community at covers.cafe.',
  };
  if (pathname === '/users') return {
    title: 'User Artists | covers.cafe',
    description: 'Discover covers.cafe community artists, browse profiles, and explore uploaded cover collections.',
  };
  if (pathname.startsWith('/users/') && pathname.includes('/collections/')) return {
    title: 'Collection | covers.cafe',
    description: 'Explore a curated cover collection on covers.cafe and discover related album artwork.',
  };
  if (pathname.startsWith('/users/')) return {
    title: 'User Profile | covers.cafe',
    description: 'View user profile details, uploaded covers, and public collections on covers.cafe.',
  };
  if (pathname === '/artists') return {
    title: 'Music Artists | covers.cafe',
    description: 'Browse music artists and discover the most shared and favorited album cover art by artist name.',
  };
  if (pathname.startsWith('/artists/')) return {
    title: 'Artist Covers | covers.cafe',
    description: 'Browse cover art for a specific artist, favorite your picks, and download images on covers.cafe.',
  };
  if (pathname === '/favorites') return {
    title: 'Favorites | covers.cafe',
    description: 'Access your favorite album covers and manage your saved artwork in one place.',
  };
  if (pathname === '/downloads') return {
    title: 'Downloads | covers.cafe',
    description: 'Review and revisit album covers you downloaded from covers.cafe.',
  };
  if (pathname === '/profile') return {
    title: 'My Profile | covers.cafe',
    description: 'Manage your covers.cafe profile, view uploads, and keep track of your account activity.',
  };
  if (pathname === '/profile/edit') return {
    title: 'Edit Profile | covers.cafe',
    description: 'Update your profile details, avatar, and links for your covers.cafe account.',
  };
  if (pathname === '/settings') return {
    title: 'Settings | covers.cafe',
    description: 'Customize appearance, preferences, and account settings on covers.cafe.',
  };
  if (pathname === '/coffee') return {
    title: 'Support covers.cafe | Buy Me a Coffee',
    description: 'Support covers.cafe and help keep the album cover art community online.',
  };
  if (pathname === '/privacy') return {
    title: 'Privacy Policy | covers.cafe',
    description: 'Read the covers.cafe privacy policy and learn how user data is handled.',
  };
  if (pathname === '/terms') return {
    title: 'Terms of Service | covers.cafe',
    description: 'Review the covers.cafe terms of service for site use, content, and account guidelines.',
  };
  if (pathname === '/about') return {
    title: 'About | covers.cafe',
    description: 'Learn about covers.cafe, the mission, and the community behind the album cover archive.',
  };
  if (pathname === '/acotw') return {
    title: 'Album Cover of the Week | covers.cafe',
    description: 'See weekly featured picks and vote results for Album Cover of the Week on covers.cafe.',
  };
  if (pathname === '/cms') return {
    title: 'CMS | covers.cafe',
    description: 'Admin and moderation tools for managing covers.cafe content and reports.',
  };
  if (pathname.startsWith('/covers/fan/')) return {
    title: 'Cover Details | covers.cafe',
    description: 'View full-size album artwork, metadata, tags, favorites, and downloads for a cover on covers.cafe.',
  };
  if (pathname.startsWith('/covers/official/')) return {
    title: 'Official Album Art | covers.cafe',
    description: 'View official album artwork, release details, favorites, and community fan covers on covers.cafe.',
  };
  if (pathname.startsWith('/cover/')) return {
    title: 'Cover Details | covers.cafe',
    description: 'View full-size album artwork, metadata, tags, favorites, and downloads for a cover on covers.cafe.',
  };
  return {
    title: 'Page Not Found | covers.cafe',
    description: 'The page you requested was not found on covers.cafe. Explore the gallery and discover album cover art.',
  };
}



/** Redirect /cover/:slug → /covers/fan/:slug for backwards compatibility. */
function LegacyCoverRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/covers/fan/${slug ?? ''}`} replace />;
}

function AppContent() {
  const { authModalOpen, authModalTab, closeAuthModal, session, user } = useAuth();
  const location = useLocation();
  const [banStatus, setBanStatus] = useState<{ isBanned: boolean; reason: string | null }>({
    isBanned: false,
    reason: null,
  });

  useEffect(() => {
    applyUserPreferencesToDocument();
  }, []);

  useEffect(() => {
    const seo = getSeoForPath(location.pathname);
    document.title = seo.title;
    upsertMetaByName('description', seo.description);
    upsertMetaByProperty('og:title', seo.title);
    upsertMetaByProperty('og:description', seo.description);
    upsertMetaByProperty('og:type', 'website');
    upsertMetaByProperty('og:url', `${window.location.origin}${location.pathname}`);
    upsertMetaByName('twitter:card', 'summary_large_image');
    upsertMetaByName('twitter:title', seo.title);
    upsertMetaByName('twitter:description', seo.description);
    upsertCanonical(`${window.location.origin}${location.pathname}`);
  }, [location.pathname]);


  useEffect(() => {
    let cancelled = false;

    async function loadBanStatus() {
      if (!user || !session?.access_token) {
        if (!cancelled) setBanStatus({ isBanned: false, reason: null });
        return;
      }

      const res = await fetch('/api/account/ban-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        if (!cancelled) setBanStatus({ isBanned: false, reason: null });
        return;
      }

      const data = await res.json() as { isBanned: boolean; reason: string | null };
      if (!cancelled) setBanStatus(data);
    }

    loadBanStatus();

    return () => {
      cancelled = true;
    };
  }, [session?.access_token, user]);

  if (banStatus.isBanned) {
    return (
      <main className="site-main" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: '20px' }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, marginBottom: 12 }}>Your account has been banned.</h1>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
            Reason: {banStatus.reason ?? 'No reason provided.'}
          </p>
          <p style={{ fontSize: 13, color: '#888' }}>
            If you believe this is a mistake, please review our{' '}
            <a href="/terms" style={{ color: '#c05a1a' }}>Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" style={{ color: '#c05a1a' }}>Privacy Policy</a>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <AppShell>
        <Routes>
          <Route path="/" element={<Gallery />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/users" element={<Artists />} />
          <Route path="/users/:username" element={<ArtistDetail />} />
          <Route path="/users/:username/collections/:collectionId" element={<CollectionDetail />} />
          <Route path="/artists" element={<MusicArtists />} />
          <Route path="/artists/:artistName" element={<MusicArtistDetail />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/coffee" element={<Coffee />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/about" element={<About />} />
          <Route path="/acotw" element={<Acotw />} />
          <Route path="/cms" element={<Cms />} />
          <Route path="/covers/fan/:slug" element={<CoverDetail />} />
          <Route path="/covers/official/:slug" element={<OfficialCoverDetail />} />
          {/* Legacy redirect  -  old /cover/ links go to the new fan path */}
          <Route path="/cover/:slug" element={<LegacyCoverRedirect />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>

      {authModalOpen && (
        <AuthModal tab={authModalTab} onClose={closeAuthModal} />
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
