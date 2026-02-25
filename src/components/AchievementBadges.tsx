import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AcotwTrophyIcon from './AcotwTrophyIcon';
import ClimbTopIcon from './ClimbTopIcon';
import Building1Icon from './Building1Icon';
import CakePondIcon from './CakePondIcon';
import { supabase } from '../lib/supabase';

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

type Milestone = { id: string; label: string; icon: React.ReactNode; cssClass: string };

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

function getMilestones(coverCount: number): Milestone[] {
  const earned: Milestone[] = [];
  if (coverCount >= 1) earned.push({
    id: 'welcome',
    label: 'Welcome to the Party',
    icon: <CakePondIcon size={25} />,
    cssClass: 'ach-badge--welcome',
  });
  if (coverCount >= 50) earned.push({
    id: 'city',
    label: 'Entering the City',
    icon: <Building1Icon size={25} />,
    cssClass: 'ach-badge--city',
  });
  if (coverCount >= 100) earned.push({
    id: 'crest',
    label: 'Beyond the Crest',
    icon: <ClimbTopIcon size={25} />,
    cssClass: 'ach-badge--crest',
  });
  return earned;
}

export default function AchievementBadges({ userId }: Props) {
  const navigate = useNavigate();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [coverCount, setCoverCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    Promise.all([
      fetch('/api/achievements?userId=' + encodeURIComponent(userId))
        .then((r) => r.json())
        .then((d: { achievements: Achievement[] }) => d.achievements ?? [])
        .catch(() => [] as Achievement[]),
      supabase
        .from('covers_cafe_covers')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_public', true)
        .then(({ count }) => count ?? 0),
    ]).then(([achs, count]) => {
      if (cancelled) return;
      setAchievements(achs);
      setCoverCount(count as number);
      setLoaded(true);
    });

    return () => { cancelled = true; };
  }, [userId]);

  const milestones = getMilestones(coverCount);
  if (!loaded || (achievements.length === 0 && milestones.length === 0)) return null;

  return (
    <div className="ach-wrap">
      <h3 className="ach-heading">Achievements</h3>
      <div className="ach-list">
        {milestones.map((m) => (
          <div key={m.id} className={'ach-badge ' + m.cssClass} title={m.label}>
            <span className="ach-icon">{m.icon}</span>
            <div className="ach-info">
              <span className="ach-label">{m.label}</span>
            </div>
          </div>
        ))}

        {achievements.map((a) => {
          if (a.type === 'acotw') {
            return (
              <div key={a.id} className="ach-badge ach-badge--acotw" title={'Album Cover of the Week' + (a.metadata?.week_start ? ' · ' + formatMonth(a.metadata.week_start) : '')}>
                <span className="ach-icon"><AcotwTrophyIcon size={25} /></span>
                <div className="ach-info">
                  <span className="ach-label">Album Cover of the Week</span>
                  {a.metadata?.cover_title && (
                    <span
                      className="ach-detail"
                      onClick={() => a.metadata?.cover_id && navigate('/cover/' + a.metadata.cover_id)}
                      style={a.metadata?.cover_id ? { cursor: 'pointer' } : undefined}
                    >
                      {a.metadata.cover_title}
                      {a.metadata.cover_artist ? ' · ' + a.metadata.cover_artist : ''}
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
