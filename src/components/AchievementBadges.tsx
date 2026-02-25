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

      
    </div>
  );
}
