import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingIcon from '../components/LoadingIcon';
import CastleIcon from '../components/CastleIcon';
import DotSeparator from '../components/DotSeparator';

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
            Comments inducted by communal heuristic consensus  -  preserved in perpetuity.
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
                            <em>{pin.cover_title ?? ''}{pin.cover_artist ? <><DotSeparator />{pin.cover_artist}</> : null}</em>
                          </button>
                        ) : (
                          <span className="poh-on">
                            on{' '}
                            <em>{pin.cover_title ?? ''}{pin.cover_artist ? <><DotSeparator />{pin.cover_artist}</> : null}</em>
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

      
    </div>
  );
}
