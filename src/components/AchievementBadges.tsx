import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AcotwTrophyIcon from './AcotwTrophyIcon';

type Achievement = {
  id: string;
  type: 'acotw';
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
                <span className="ach-icon"><AcotwTrophyIcon size={25} /></span>
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
          border-radius: 0;
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


        .ach-date {
          font-size: 17px;
          color: var(--body-text-muted);
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}
