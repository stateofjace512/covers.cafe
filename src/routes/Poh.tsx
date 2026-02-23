import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingIcon from '../components/LoadingIcon';
import CastleIcon from '../components/CastleIcon';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;

function getCoverThumb(storagePath: string | null, imageUrl: string | null): string | null {
  if (storagePath && SUPABASE_URL) {
    return `${SUPABASE_URL}/storage/v1/render/image/public/covers_cafe_covers/${storagePath}?width=120&height=120&resize=cover&quality=80`;
  }
  return imageUrl ?? null;
}

function formatPinnedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

type PohPin = {
  id: string;
  comment_content: string;
  author_username: string;
  author_user_id: string | null;
  cover_id: string | null;
  cover_title: string | null;
  cover_artist: string | null;
  cover_storage_path: string | null;
  cover_image_url: string | null;
  page_slug: string | null;
  pinned_at: string;
};

export default function Poh() {
  const navigate = useNavigate();
  const [pins, setPins] = useState<PohPin[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPins = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/poh/pins');
    if (res.ok) {
      const data = await res.json() as { pins: PohPin[] };
      setPins(data.pins);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadPins(); }, [loadPins]);

  return (
    <div className="poh-page">

      {/* ── Hall header ──────────────────────────────────────────── */}
      <div className="poh-header">
        <div className="poh-header-arch" aria-hidden="true" />
        <div className="poh-header-content">
          <span className="poh-stadium-icon" aria-label="castle">
            <CastleIcon size={36} />
          </span>
          <h1 className="poh-title">THE PIN OF HEURISTICS</h1>
          <p className="poh-subtitle">
            Comments inducted by communal heuristic consensus — preserved in perpetuity.
          </p>
        </div>
        <div className="poh-header-arch poh-header-arch--bottom" aria-hidden="true" />
      </div>

      {/* ── Pins ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="poh-loading">
          <LoadingIcon size={22} className="poh-spinner" />
          <span>Preparing the hall…</span>
        </div>
      ) : pins.length === 0 ? (
        <div className="poh-empty">
          <span className="poh-empty-icon"><CastleIcon size={48} /></span>
          <p>The hall awaits its first inductee.</p>
          <p className="poh-empty-sub">Outstanding comments will be enshrined here by the operators.</p>
        </div>
      ) : (
        <div className="poh-hall">
          {pins.map((pin) => {
            const thumb = getCoverThumb(pin.cover_storage_path, pin.cover_image_url);
            return (
              <article key={pin.id} className="poh-frame-wrap">
                {/* The framed portrait */}
                <div className="poh-frame">
                  <div className="poh-frame-inner">

                    {/* Cover art thumbnail in corner */}
                    {thumb && (
                      <div
                        className={`poh-cover-corner${pin.page_slug ? ' poh-cover-corner--link' : ''}`}
                        onClick={pin.page_slug ? () => navigate(`/cover/${pin.page_slug}`) : undefined}
                        title={pin.page_slug ? `View ${pin.cover_title ?? 'cover'}` : undefined}
                      >
                        <img
                          src={thumb}
                          alt={pin.cover_title ?? 'album cover'}
                          className="poh-cover-thumb"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* The comment text */}
                    <blockquote className="poh-quote">
                      <span className="poh-open-quote">"</span>
                      {pin.comment_content}
                      <span className="poh-close-quote">"</span>
                    </blockquote>

                    {/* Attribution */}
                    <div className="poh-attribution">
                      <span className="poh-reaction">
                        <CastleIcon size={16} />
                      </span>
                      <button
                        className="poh-author"
                        onClick={() => navigate(`/users/${pin.author_username}`)}
                      >
                        @{pin.author_username}
                      </button>
                      {(pin.cover_title || pin.cover_artist) && (
                        pin.page_slug ? (
                          <button
                            className="poh-on poh-on--link"
                            onClick={() => navigate(`/cover/${pin.page_slug}`)}
                          >
                            on{' '}
                            <em>{pin.cover_title ?? ''}{pin.cover_artist ? ` · ${pin.cover_artist}` : ''}</em>
                          </button>
                        ) : (
                          <span className="poh-on">
                            on{' '}
                            <em>{pin.cover_title ?? ''}{pin.cover_artist ? ` · ${pin.cover_artist}` : ''}</em>
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* The plaque */}
                <div className="poh-plaque">
                  <div className="poh-plaque-screws" aria-hidden="true">
                    <span /><span />
                  </div>
                  <p className="poh-plaque-text">Inducted by Communal Heuristic Consensus.</p>
                  <p className="poh-plaque-date">{formatPinnedDate(pin.pinned_at)}</p>
                  <div className="poh-plaque-screws" aria-hidden="true">
                    <span /><span />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style>{`
        /* ── Page shell ────────────────────────────────────────────── */
        .poh-page {
          display: flex;
          flex-direction: column;
          gap: 36px;
          min-height: 60vh;
        }

        /* ── Header ────────────────────────────────────────────────── */
        .poh-header {
          position: relative;
          text-align: center;
          padding: 40px 20px 36px;
          background:
            linear-gradient(180deg,
              rgba(255,255,255,0.18) 0%,
              rgba(255,255,255,0.04) 60%,
              rgba(0,0,0,0.06) 100%
            ),
            /* marble veining */
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.025' numOctaves='6' seed='8' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0.15'/%3E%3C/filter%3E%3Crect width='400' height='200' filter='url(%23m)' opacity='0.22'/%3E%3C/svg%3E"),
            linear-gradient(135deg, #e8ddd0 0%, #d4c5b0 40%, #c8b89a 100%);
          border: 2px solid #b8a080;
          border-radius: 4px;
          box-shadow:
            0 4px 24px rgba(60,30,10,0.35),
            inset 0 1px 0 rgba(255,255,255,0.5),
            inset 0 -1px 0 rgba(0,0,0,0.1);
          overflow: hidden;
        }

        [data-theme="dark"] .poh-header {
          background:
            linear-gradient(180deg,
              rgba(255,255,255,0.04) 0%,
              rgba(0,0,0,0.2) 100%
            ),
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.025' numOctaves='6' seed='8' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0.06'/%3E%3C/filter%3E%3Crect width='400' height='200' filter='url(%23m)' opacity='0.35'/%3E%3C/svg%3E"),
            linear-gradient(135deg, #1a1210 0%, #0e0a08 100%);
          border-color: #7a1010;
          box-shadow:
            0 4px 32px rgba(0,0,0,0.8),
            inset 0 1px 0 rgba(200,40,40,0.15),
            0 0 60px rgba(120,10,10,0.2);
        }

        .poh-header-arch {
          display: none; /* decorative arch removed for simplicity */
        }

        .poh-header-content {
          position: relative;
          z-index: 1;
        }

        .poh-stadium-icon {
          display: block;
          font-size: 36px;
          margin-bottom: 10px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }

        .poh-title {
          font-size: clamp(20px, 4vw, 32px);
          font-weight: bold;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #3a2008;
          text-shadow:
            0 1px 0 rgba(255,255,255,0.6),
            0 2px 4px rgba(60,20,0,0.3);
          margin: 0 0 10px;
          font-family: Georgia, 'Times New Roman', serif;
        }

        [data-theme="dark"] .poh-title {
          color: #c8a070;
          text-shadow:
            0 1px 0 rgba(0,0,0,0.8),
            0 0 20px rgba(200,80,40,0.4);
        }

        .poh-subtitle {
          font-size: 13px;
          color: #6b3d1f;
          font-style: italic;
          letter-spacing: 0.4px;
          opacity: 0.85;
        }

        [data-theme="dark"] .poh-subtitle {
          color: #a06040;
        }

        /* ── Loading / Empty ───────────────────────────────────────── */
        .poh-loading {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--body-text-muted);
          justify-content: center;
          padding: 60px 0;
          font-style: italic;
        }

        .poh-spinner {
          animation: poh-spin 0.9s linear infinite;
        }

        @keyframes poh-spin { to { transform: rotate(360deg); } }

        .poh-empty {
          text-align: center;
          padding: 80px 20px;
          color: var(--body-text-muted);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .poh-empty-icon { font-size: 48px; opacity: 0.35; }
        .poh-empty p { font-size: 15px; font-style: italic; }
        .poh-empty-sub { font-size: 12px; opacity: 0.7; }

        /* ── Hall grid ──────────────────────────────────────────────── */
        .poh-hall {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 48px 36px;
          padding: 8px 0 40px;
        }

        /* ── Individual framed comment ──────────────────────────────── */
        .poh-frame-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        /* The outer wooden frame */
        .poh-frame {
          width: 100%;
          padding: 10px;
          background:
            linear-gradient(145deg,
              #8b5e3c 0%,
              #6b421f 25%,
              #9b6e4c 50%,
              #7a4e2a 75%,
              #5a3010 100%
            );
          border-radius: 3px;
          box-shadow:
            0 6px 24px rgba(40,15,0,0.55),
            inset 0 1px 0 rgba(255,255,255,0.25),
            inset 0 -2px 0 rgba(0,0,0,0.4),
            inset 3px 0 6px rgba(0,0,0,0.2),
            inset -3px 0 6px rgba(0,0,0,0.2);
          /* Wood grain */
          background-image:
            repeating-linear-gradient(
              5deg,
              transparent 0px, transparent 6px,
              rgba(255,255,255,0.03) 6px, rgba(255,255,255,0.03) 7px,
              transparent 7px, transparent 14px,
              rgba(0,0,0,0.04) 14px, rgba(0,0,0,0.04) 15px
            ),
            linear-gradient(145deg,
              #8b5e3c 0%,
              #6b421f 25%,
              #9b6e4c 50%,
              #7a4e2a 75%,
              #5a3010 100%
            );
          position: relative;
        }

        [data-theme="dark"] .poh-frame {
          background-image:
            repeating-linear-gradient(
              5deg,
              transparent 0px, transparent 6px,
              rgba(255,255,255,0.02) 6px, rgba(255,255,255,0.02) 7px,
              transparent 7px, transparent 14px,
              rgba(0,0,0,0.08) 14px, rgba(0,0,0,0.08) 15px
            ),
            linear-gradient(145deg,
              #1a0a06 0%,
              #0d0604 25%,
              #200e08 50%,
              #120704 75%,
              #080302 100%
            );
          box-shadow:
            0 8px 32px rgba(0,0,0,0.9),
            0 0 0 2px #6a0808,
            0 0 0 3px #1a0404,
            inset 0 1px 0 rgba(200,40,40,0.2),
            inset 0 -2px 0 rgba(0,0,0,0.8),
            inset 3px 0 8px rgba(0,0,0,0.5),
            inset -3px 0 8px rgba(0,0,0,0.5);
        }

        /* Inner mat / canvas */
        .poh-frame-inner {
          position: relative;
          background:
            linear-gradient(160deg, #fdf6ea 0%, #f5e8d0 60%, #ede0c0 100%);
          border: 1px solid rgba(160,100,40,0.3);
          box-shadow: inset 0 2px 8px rgba(60,20,0,0.15);
          padding: 24px 20px 18px;
          min-height: 160px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        [data-theme="dark"] .poh-frame-inner {
          background:
            linear-gradient(160deg, #160c08 0%, #0e0806 60%, #0a0604 100%);
          border-color: rgba(120,20,20,0.4);
          box-shadow: inset 0 2px 12px rgba(0,0,0,0.6);
        }

        /* Cover art thumb in top-right corner */
        .poh-cover-corner {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 72px;
          height: 72px;
          border-radius: 2px;
          overflow: hidden;
          box-shadow:
            0 2px 8px rgba(0,0,0,0.4),
            0 0 0 1px rgba(100,60,20,0.4);
          flex-shrink: 0;
        }

        .poh-cover-corner--link {
          cursor: pointer;
        }

        .poh-cover-corner--link::after {
          content: '↗';
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.5);
          color: #fff;
          font-size: 20px;
          opacity: 0;
          transition: opacity 0.15s;
        }

        .poh-cover-corner--link:hover::after {
          opacity: 1;
        }

        .poh-cover-corner--link:hover {
          box-shadow:
            0 4px 14px rgba(0,0,0,0.55),
            0 0 0 2px rgba(180,120,20,0.8);
        }

        .poh-cover-thumb {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        /* The quote */
        .poh-quote {
          font-size: 14px;
          line-height: 1.7;
          color: #2a1505;
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          word-break: break-word;
          padding-right: ${/* space for cover corner */ ''}86px;
          flex: 1;
          position: relative;
        }

        [data-theme="dark"] .poh-quote {
          color: #d4b896;
        }

        .poh-open-quote,
        .poh-close-quote {
          font-size: 28px;
          line-height: 0;
          vertical-align: -8px;
          color: rgba(140,80,20,0.5);
          font-style: normal;
          font-family: Georgia, serif;
        }

        [data-theme="dark"] .poh-open-quote,
        [data-theme="dark"] .poh-close-quote {
          color: rgba(160,60,40,0.5);
        }

        .poh-open-quote { margin-right: 3px; }
        .poh-close-quote { margin-left: 3px; }

        /* Author / attribution row */
        .poh-attribution {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          border-top: 1px solid rgba(160,100,40,0.2);
          padding-top: 10px;
          margin-top: 4px;
        }

        [data-theme="dark"] .poh-attribution {
          border-top-color: rgba(120,30,30,0.3);
        }

        .poh-reaction {
          font-size: 16px;
          flex-shrink: 0;
        }

        .poh-author {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
          color: #8b4513;
          padding: 0;
          box-shadow: none;
          font-family: Arial, Helvetica, sans-serif;
          letter-spacing: 0.3px;
        }

        .poh-author:hover {
          color: #c05a1a;
          text-decoration: underline;
          transform: none;
        }

        [data-theme="dark"] .poh-author {
          color: #c07040;
        }

        [data-theme="dark"] .poh-author:hover {
          color: #e08050;
        }

        .poh-on {
          font-size: 11px;
          color: #7a5030;
          font-style: italic;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 160px;
        }

        [data-theme="dark"] .poh-on {
          color: #806050;
        }

        .poh-on--link {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          box-shadow: none;
          text-align: left;
        }

        .poh-on--link:hover {
          color: #c05a1a;
          text-decoration: underline;
          transform: none;
        }

        [data-theme="dark"] .poh-on--link:hover {
          color: #e08050;
        }

        /* ── The plaque ──────────────────────────────────────────────── */
        .poh-plaque {
          width: 85%;
          background:
            linear-gradient(180deg, #c8a840 0%, #b89030 40%, #a87820 100%);
          border: 1px solid #906010;
          border-radius: 4px;
          padding: 8px 16px 10px;
          text-align: center;
          box-shadow:
            0 4px 12px rgba(60,30,0,0.4),
            inset 0 1px 0 rgba(255,255,255,0.25),
            inset 0 -1px 0 rgba(0,0,0,0.2);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        [data-theme="dark"] .poh-plaque {
          background:
            linear-gradient(180deg, #8a0c0c 0%, #6e0808 40%, #520404 100%);
          border-color: #3a0202;
          box-shadow:
            0 4px 16px rgba(0,0,0,0.7),
            inset 0 1px 0 rgba(255,100,100,0.2),
            inset 0 -1px 0 rgba(0,0,0,0.5);
        }

        .poh-plaque-screws {
          display: flex;
          justify-content: space-between;
          width: 100%;
        }

        .poh-plaque-screws span {
          display: block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #e8c060, #806010);
          box-shadow: 0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3);
        }

        [data-theme="dark"] .poh-plaque-screws span {
          background: radial-gradient(circle at 35% 35%, #c06060, #400808);
          box-shadow: 0 1px 2px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,150,150,0.2);
        }

        .poh-plaque-text {
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: #3a2000;
          text-shadow: 0 1px 0 rgba(255,255,255,0.3);
          font-family: Georgia, 'Times New Roman', serif;
        }

        [data-theme="dark"] .poh-plaque-text {
          color: #f5c0c0;
          text-shadow: 0 1px 0 rgba(0,0,0,0.5);
        }

        .poh-plaque-date {
          font-size: 10px;
          color: rgba(58,32,0,0.75);
          letter-spacing: 0.4px;
          font-style: italic;
        }

        [data-theme="dark"] .poh-plaque-date {
          color: rgba(245,180,180,0.65);
        }

        /* ── Responsive ─────────────────────────────────────────────── */
        @media (max-width: 600px) {
          .poh-hall {
            grid-template-columns: 1fr;
            gap: 40px 0;
          }

          .poh-plaque { width: 90%; }
        }
      `}</style>
    </div>
  );
}
