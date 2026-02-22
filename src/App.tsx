import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppShell from './components/AppShell';
import AuthModal from './components/AuthModal';

// Route pages
import Gallery from './routes/Gallery';
import Upload from './routes/Upload';
import Artists from './routes/Artists';
import ArtistDetail from './routes/ArtistDetail';
import Favorites from './routes/Favorites';
import Downloads from './routes/Downloads';
import Profile from './routes/Profile';
import EditProfile from './routes/EditProfile';
import Settings from './routes/Settings';
import Coffee from './routes/Coffee';
import Privacy from './routes/Privacy';
import Terms from './routes/Terms';

function AppContent() {
  const { authModalOpen, authModalTab, closeAuthModal } = useAuth();

  return (
    <>
      <AppShell>
        <Routes>
          <Route path="/" element={<Gallery />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/artists" element={<Artists />} />
          <Route path="/artists/:username" element={<ArtistDetail />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/coffee" element={<Coffee />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<Gallery />} />
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
