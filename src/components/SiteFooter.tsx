import { useNavigate } from 'react-router-dom';

export default function SiteFooter() {
  const navigate = useNavigate();
  return (
    <footer className="site-footer-global">
      <span>covers.cafe</span>
      <button onClick={() => navigate('/privacy')}>Privacy</button>
      <button onClick={() => navigate('/terms')}>Terms</button>
      <button onClick={() => navigate('/about')}>About</button>
      <style>{`
        .site-footer-global { display:flex; gap:10px; align-items:center; justify-content:center; margin-top: 28px; padding: 16px; border-top:1px solid var(--body-border); color: var(--body-text-muted); font-size: 12px; }
        .site-footer-global button { background:none; border:none; color:inherit; text-decoration: underline; cursor:pointer; box-shadow:none; }
      `}</style>
    </footer>
  );
}
