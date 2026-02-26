import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  emailVerified: boolean;
  // Modal controls  -  lifted here so any component can call openAuthModal()
  authModalOpen: boolean;
  authModalTab: 'login' | 'register' | 'verify';
  openAuthModal: (tab?: 'login' | 'register' | 'verify') => void;
  closeAuthModal: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfilePicture: (avatarUrl: string | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  emailVerified: false,
  authModalOpen: false,
  authModalTab: 'login',
  openAuthModal: () => {},
  closeAuthModal: () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  updateProfilePicture: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register' | 'verify'>('login');
  // Guard so we only auto-open the verify modal once per session load, not on every render.
  const autoVerifyFired = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('covers_cafe_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data as Profile);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        // Don't auto-close modal here  -  AuthModal handles it after verification
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // If the user has a live session but hasn't verified their email yet, surface the
  // verify modal automatically  -  this keeps the flow alive across page reloads.
  useEffect(() => {
    if (user && profile && !profile.email_verified && !autoVerifyFired.current) {
      autoVerifyFired.current = true;
      setAuthModalTab('verify');
      setAuthModalOpen(true);
    }
    if (!user || profile?.email_verified) {
      autoVerifyFired.current = false;
    }
  }, [user, profile]);

  const openAuthModal = useCallback((tab: 'login' | 'register' | 'verify' = 'login') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const updateProfilePicture = useCallback((avatarUrl: string | null) => {
    setProfile((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : prev));
  }, []);

  const emailVerified = profile?.email_verified ?? false;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        emailVerified,
        authModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
        signOut,
        refreshProfile,
        updateProfilePicture,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
