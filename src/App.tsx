import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppShell from './components/AppShell';
import AuthModal from './components/AuthModal';

// Route pages
import Gallery from './routes/Gallery';
import Upload from './routes/Upload';
import Artists from './routes/Artists';
import ArtistDetail from './routes/ArtistDetail';
import CollectionDetail from './routes/CollectionDetail';
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


function LegacyArtistRedirect() {
  const { username } = useParams<{ username: string }>();
  return <Navigate to={username ? `/users/${encodeURIComponent(username)}` : '/users'} replace />;
}

function AppContent() {
  const { authModalOpen, authModalTab, closeAuthModal, session, user } = useAuth();
  const [banStatus, setBanStatus] = useState<{ isBanned: boolean; reason: string | null }>({
    isBanned: false,
    reason: null,
  });

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
      <main className="site-main" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <h1>You are banned. Reason: {banStatus.reason ?? 'No reason provided.'}</h1>
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
          <Route path="/artists" element={<Navigate to="/users" replace />} />
          <Route path="/artists/:username" element={<LegacyArtistRedirect />} />
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
