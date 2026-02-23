import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CastleIcon from './CastleIcon';

type Achievement = {
  id: string;
  type: 'acotw' | 'poh';
  reference_id: string | null;
  metadata: {
    cover_title?: string | null;
    cover_artist?: string | null;
    week_start?: string | null;
    cover_id?: string | null;
    cover_page_slug?: string | null;
    comment_preview?: string | null;
  } | null;
  awarded_at: string;
};

interface Props {
  userId: string;
}

function formatMonth(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function AchievementBadges({ userId }: Props) {
  const navigate = useNavigate();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/achievements?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data: { achievements: Achievement[] }) => {
        setAchievements(data.achievements ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [userId]);

  if (!loaded || achievements.length === 0) return null;

  return (
    <div className="ach-wrap">
      <h3 className="ach-heading">Achievements</h3>
      <div className="ach-list">
        {achievements.map((a) => {
          if (a.type === 'acotw') {
            return (
              <div key={a.id} className="ach-badge ach-badge--acotw" title={`Album Cover of the Week · ${a.metadata?.week_start ? formatMonth(a.metadata.week_start) : ''}`}>
                <span className="ach-icon">🏆</span>
                <div className="ach-info">
                  <span className="ach-label">Album Cover of the Week</span>
                  {a.metadata?.cover_title && (
                    <span
                      className="ach-detail"
                      onClick={() => a.metadata?.cover_id && navigate(`/cover/${a.metadata.cover_id}`)}
                      style={a.metadata?.cover_id ? { cursor: 'pointer' } : undefined}
                    >
                      {a.metadata.cover_title}
                      {a.metadata.cover_artist ? ` · ${a.metadata.cover_artist}` : ''}
                    </span>
                  )}
                  {a.metadata?.week_start && (
                    <span className="ach-date">{formatMonth(a.metadata.week_start)}</span>
                  )}
                </div>
              </div>
            );
          }

          if (a.type === 'poh') {
            return (
              <div key={a.id} className="ach-badge ach-badge--poh" title="Pin of Heuristics inductee">
                <span className="ach-icon"><CastleIcon size={22} /></span>
                <div className="ach-info">
                  <span className="ach-label">Pin of Heuristics</span>
                  {a.metadata?.comment_preview && (
                    <span
                      className="ach-detail ach-detail--quote"
                      onClick={() => navigate('/poh')}
                      style={{ cursor: 'pointer' }}
                    >
                      "{a.metadata.comment_preview}{a.metadata.comment_preview.length >= 120 ? '…' : ''}"
                    </span>
                  )}
                  {(a.metadata?.cover_title || a.metadata?.cover_artist) && (
                    <span
                      className="ach-detail"
                      onClick={() => a.metadata?.cover_page_slug && navigate(`/cover/${a.metadata.cover_page_slug}`)}
                      style={a.metadata?.cover_page_slug ? { cursor: 'pointer' } : undefined}
                    >
                      on {a.metadata.cover_title ?? ''}{a.metadata.cover_artist ? ` · ${a.metadata.cover_artist}` : ''}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>

      <style>{`
        .ach-wrap {
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid var(--body-border);
        }

        .ach-heading {
          font-size: 19px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--body-text-muted);
          margin-bottom: 12px;
        }

        .ach-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .ach-badge {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 6px;
          border: 1px solid;
        }

        .ach-badge--acotw {
          background: linear-gradient(135deg, rgba(184,134,11,0.1) 0%, rgba(192,90,26,0.06) 100%);
          border-color: rgba(184,134,11,0.3);
        }

        [data-theme="dark"] .ach-badge--acotw {
          background: linear-gradient(135deg, rgba(184,134,11,0.12) 0%, rgba(120,60,10,0.1) 100%);
          border-color: rgba(184,134,11,0.25);
        }

        .ach-badge--poh {
          background: linear-gradient(135deg, rgba(80,50,120,0.08) 0%, rgba(60,30,100,0.04) 100%);
          border-color: rgba(100,60,150,0.25);
        }

        [data-theme="dark"] .ach-badge--poh {
          background: linear-gradient(135deg, rgba(120,20,20,0.15) 0%, rgba(80,10,10,0.1) 100%);
          border-color: rgba(160,30,30,0.3);
        }

        .ach-icon {
          font-size: 25px;
          flex-shrink: 0;
          line-height: 1;
          margin-top: 1px;
        }

        .ach-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .ach-label {
          font-size: 19px;
          color: var(--body-text);
        }

        .ach-detail {
          font-size: 18px;
          color: var(--body-text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ach-detail--quote {
          font-style: italic;
          white-space: normal;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .ach-detail--quote:hover {
          color: var(--accent);
          text-decoration: underline;
        }

        .ach-date {
          font-size: 17px;
          color: var(--body-text-muted);
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}
