import { Coffee } from 'lucide-react';

export default function CoffeePage() {
  return (
    <div>
      <h1 className="section-title"><Coffee size={22} /> Coffee Corner</h1>
      <div className="card coffee-card">
        <Coffee size={52} style={{ opacity: 0.25, marginBottom: 16 }} />
        <p className="coffee-message">You found the coffee corner. ☕</p>
        <p className="coffee-sub">This is where future surprises will live. Stay tuned.</p>
        <p className="text-muted text-sm" style={{ marginTop: 16 }}>
          covers.cafe is brewed with love for music and album art.
        </p>
      </div>
      <style>{`
        .coffee-card {
          max-width: 380px; text-align: center; padding: 50px 32px;
          display: flex; flex-direction: column; align-items: center;
        }
        .coffee-message { font-size: 20px; font-weight: bold; color: var(--body-text); margin-bottom: 8px; }
        .coffee-sub { font-size: 14px; color: var(--body-text-muted); line-height: 1.6; }
      `}</style>
    </div>
  );
}
