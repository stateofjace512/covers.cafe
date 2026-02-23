import { useEffect, useState, useCallback } from 'react';
import TrophyIcon from '../components/TrophyIcon';
import FavoritesIcon from '../components/FavoritesIcon';
import LoadingIcon from '../components/LoadingIcon';
import ClockIcon from '../components/ClockIcon';
import ChevronDownIcon from '../components/ChevronDownIcon';
import ChevronUpIcon from '../components/ChevronUpIcon';
import { useAuth } from '../contexts/AuthContext';
import { getCoverImageSrc } from '../lib/media';
import type { Cover } from '../lib/types';

type Nominee = { cover: Cover; vote_count: number };
type Poll = { id: string; week_start: string; closed_at: string | null; winner_cover_id: string | null };
type PollData = { poll: Poll | null; nominees: Nominee[]; user_vote: string | null; total_votes: number };
type HistoryEntry = { poll_id: string; week_start: string; closed_at: string; total_votes: number; cover: Cover | null };

function formatWeek(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export default function Acotw() {
  const { user, session, openAuthModal } = useAuth();
  const [data, setData] = useState<PollData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null); // coverId being voted on
  const [showArchive, setShowArchive] = useState(false);

  const authHeader = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

  const loadCurrent = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await fetch('/api/acotw/current', { headers: authHeader });
    if (res.ok) setData(await res.json() as PollData);
    if (!silent) setLoading(false);
  }, [session?.access_token]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const res = await fetch('/api/acotw/history');
    if (res.ok) setHistory(await res.json() as HistoryEntry[]);
    setHistoryLoading(false);
  }, []);

  useEffect(() => { loadCurrent(); }, [loadCurrent]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function handleVote(coverId: string) {
    if (!user) { openAuthModal('login'); return; }
    if (!session?.access_token) return;
    setVoting(coverId);
    const res = await fetch('/api/acotw/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ coverId }),
    });
    if (res.ok) {
      await loadCurrent(true);
    }
    setVoting(null);
  }

  const poll = data?.poll;
  const nominees = data?.nominees ?? [];
  const userVote = data?.user_vote ?? null;
  const totalVotes = data?.total_votes ?? 0;
  const isClosed = Boolean(poll?.closed_at);
  const hasVoted = Boolean(userVote);

  return (
    <div className="acotw-page">
      <div className="acotw-header">
        <div className="acotw-header-icon"><TrophyIcon size={28} /></div>
        <div>
          <h1 className="acotw-title">Album Cover Of The Week</h1>
          <p className="acotw-subtitle">
            {isClosed
              ? 'Voting has closed — see the winner below.'
              : poll
              ? `Vote for your favourite cover this week · Week of ${formatWeek(poll.week_start)}`
              : 'Community vote — every week, top 10 most-favorited covers go head-to-head.'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="acotw-loading"><LoadingIcon size={24} className="acotw-spinner" /><span>Loading poll…</span></div>
      ) : !poll || nominees.length === 0 ? (
        <div className="acotw-empty">
          <FavoritesIcon size={40} style={{ opacity: 0.3 }} />
          <p>No poll yet — favorite some covers to fuel next week's nominees!</p>
        </div>
      ) : (
        <>
          {/* Vote progress bar */}
          <div className="acotw-meta">
            <span className="acotw-vote-total"><FavoritesIcon size={13} />{totalVotes} vote{totalVotes !== 1 ? 's' : ''} cast</span>
            {!isClosed && !hasVoted && !user && (
              <button className="btn btn-primary acotw-signin-btn" onClick={() => openAuthModal('login')}>
                Sign in to vote
              </button>
            )}
            {!isClosed && hasVoted && (
              <span className="acotw-voted-label"><ClockIcon size={13} />You voted — results reveal Sunday night</span>
            )}
          </div>

          {/* Winner banner (closed poll) */}
          {isClosed && poll.winner_cover_id && (() => {
            const winner = nominees.find((n) => n.cover.id === poll.winner_cover_id);
            if (!winner) return null;
            return (
              <div className="acotw-winner-banner">
                <div className="acotw-winner-badge"><TrophyIcon size={16} /> This Week's Winner</div>
                <div className="acotw-winner-cover-wrap">
                  <img src={getCoverImageSrc(winner.cover) ?? ''} alt={winner.cover.title} className="acotw-winner-img" />
                </div>
                <div>
                  <div className="acotw-winner-title">{winner.cover.title}</div>
                  <div className="acotw-winner-artist">{winner.cover.artist}</div>
                  <div className="acotw-winner-votes">{winner.vote_count} vote{winner.vote_count !== 1 ? 's' : ''}</div>
                </div>
              </div>
            );
          })()}

          {/* Nominees grid */}
          <div className="acotw-grid">
            {nominees.map((n) => {
              const isWinner = isClosed && n.cover.id === poll.winner_cover_id;
              const isMyVote = n.cover.id === userVote;
              const pct = totalVotes > 0 ? Math.round((n.vote_count / totalVotes) * 100) : 0;

              return (
                <div
                  key={n.cover.id}
                  className={`acotw-card${isWinner ? ' acotw-card--winner' : ''}${isMyVote ? ' acotw-card--voted' : ''}`}
                >
                  <div className="acotw-card-img-wrap">
                    {getCoverImageSrc(n.cover) && (
                      <img src={getCoverImageSrc(n.cover)!} alt={n.cover.title} className="acotw-card-img" loading="lazy" />
                    )}
                    {isWinner && <div className="acotw-card-winner-overlay"><TrophyIcon size={20} /></div>}
                  </div>
                  <div className="acotw-card-body">
                    <div className="acotw-card-title" title={n.cover.title}>{n.cover.title}</div>
                    <div className="acotw-card-artist">{n.cover.artist}</div>

                    {/* Vote bar — only visible after user voted or poll closed */}
                    {(hasVoted || isClosed) && (
                      <div className="acotw-bar-wrap" title={`${pct}%`}>
                        <div className="acotw-bar" style={{ width: `${pct}%` }} />
                        <span className="acotw-bar-pct">{pct}%</span>
                      </div>
                    )}

                    {!isClosed && (
                      <button
                        className={`btn acotw-vote-btn${isMyVote ? ' acotw-vote-btn--active' : ''}`}
                        onClick={() => handleVote(n.cover.id)}
                        disabled={Boolean(voting)}
                      >
                        {voting === n.cover.id
                          ? <LoadingIcon size={13} className="acotw-spinner" />
                          : isMyVote
                          ? <><FavoritesIcon size={13} /> Voted</>
                          : <><FavoritesIcon size={13} /> Vote</>}
                      </button>
                    )}

                    <div className="acotw-card-count">
                      {(hasVoted || isClosed) ? `${n.vote_count} vote${n.vote_count !== 1 ? 's' : ''}` : '\u00a0'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Archive ─────────────────────────────────────────────────────── */}
      <div className="acotw-archive-section">
        <button className="acotw-archive-toggle" onClick={() => setShowArchive((v) => !v)}>
          <TrophyIcon size={15} />
          Past Winners
          {showArchive ? <ChevronUpIcon size={15} /> : <ChevronDownIcon size={15} />}
          {history.length > 0 && <span className="acotw-archive-count">{history.length}</span>}
        </button>

        {showArchive && (
          historyLoading ? (
            <div className="acotw-loading" style={{ padding: '20px 0' }}><LoadingIcon size={20} className="acotw-spinner" /></div>
          ) : history.length === 0 ? (
            <p className="acotw-archive-empty">No past winners yet.</p>
          ) : (
            <div className="acotw-archive-grid">
              {history.map((entry) => (
                <div key={entry.poll_id} className="acotw-archive-card">
                  {entry.cover && getCoverImageSrc(entry.cover) && (
                    <img src={getCoverImageSrc(entry.cover)!} alt={entry.cover.title} className="acotw-archive-img" loading="lazy" />
                  )}
                  <div className="acotw-archive-info">
                    <div className="acotw-archive-week">Week of {formatWeek(entry.week_start)}</div>
                    {entry.cover && (
                      <>
                        <div className="acotw-archive-title">{entry.cover.title}</div>
                        <div className="acotw-archive-artist">{entry.cover.artist}</div>
                      </>
                    )}
                    <div className="acotw-archive-votes"><FavoritesIcon size={10} /> {entry.total_votes} votes</div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <style>{`
        .acotw-page { display: flex; flex-direction: column; gap: 24px; }

        .acotw-header {
          display: flex; align-items: flex-start; gap: 16px;
          background-image:
            linear-gradient(var(--skeu-hero-tint), var(--skeu-hero-tint)),
            var(--skeu-hero);
          background-size: 100% 100%, cover;
          background-position: center, center;
          border: 1px solid var(--body-card-border); border-radius: 8px;
          padding: 24px; color: #fff8f0;
        }
        .acotw-header-icon {
          flex-shrink: 0; width: 52px; height: 52px; border-radius: 50%;
          background: rgba(184,134,11,0.25); border: 2px solid rgba(184,134,11,0.5);
          display: flex; align-items: center; justify-content: center; color: #f0c040;
        }
        .acotw-title { font-size: 24px; margin: 0 0 6px; }
        .acotw-subtitle { font-size: 20px; color: rgba(255,248,240,0.7); margin: 0; line-height: 1.5; }

        .acotw-loading { display: flex; align-items: center; gap: 10px; color: var(--body-text-muted); padding: 40px 0; }
        .acotw-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .acotw-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 20px; color: var(--body-text-muted); text-align: center; }
        .acotw-empty p { font-size: 20px; max-width: 300px; line-height: 1.6; }

        .acotw-meta {
          display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
          padding: 12px 16px; background: var(--body-card-bg);
          border: 1px solid var(--body-card-border); border-radius: 6px;
        }
        .acotw-vote-total { display: flex; align-items: center; gap: 6px; font-size: 19px; color: var(--body-text-muted); }
        .acotw-voted-label { display: flex; align-items: center; gap: 6px; font-size: 19px; color: var(--body-text-muted); }
        .acotw-signin-btn { margin-left: auto; }

        /* Winner banner */
        .acotw-winner-banner {
          display: flex; align-items: center; gap: 16px;
          background: linear-gradient(135deg, rgba(184,134,11,0.15) 0%, rgba(192,90,26,0.1) 100%);
          border: 2px solid rgba(184,134,11,0.4); border-radius: 8px; padding: 16px 20px;
        }
        .acotw-winner-badge {
          display: flex; align-items: center; gap: 6px;
          font-size: 17px; text-transform: uppercase; letter-spacing: 0.8px;
          color: #b8860b; white-space: nowrap; writing-mode: vertical-rl; text-orientation: mixed;
          transform: rotate(180deg);
        }
        .acotw-winner-cover-wrap { width: 80px; height: 80px; border-radius: 4px; overflow: hidden; flex-shrink: 0; box-shadow: var(--shadow-lg); }
        .acotw-winner-img { width: 100%; height: 100%; object-fit: cover; }
        .acotw-winner-title { font-size: 21px; color: var(--body-text); }
        .acotw-winner-artist { font-size: 20px; color: var(--body-text-muted); margin-top: 2px; }
        .acotw-winner-votes { font-size: 18px; color: #b8860b; margin-top: 6px; }

        /* Nominees grid */
        .acotw-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 14px;
        }
        .acotw-card {
          background: var(--body-card-bg); border: 1px solid var(--body-card-border);
          border-radius: 8px; overflow: hidden;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .acotw-card:hover { border-color: var(--accent); box-shadow: var(--shadow-md); }
        .acotw-card--winner { border-color: #b8860b; box-shadow: 0 0 0 2px rgba(184,134,11,0.25); }
        .acotw-card--voted { border-color: var(--accent); }

        .acotw-card-img-wrap { position: relative; aspect-ratio: 1; overflow: hidden; background: var(--body-border); }
        .acotw-card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .acotw-card-winner-overlay {
          position: absolute; top: 6px; right: 6px;
          background: rgba(184,134,11,0.9); color: white;
          border-radius: 50%; width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
        }

        .acotw-card-body { padding: 10px; display: flex; flex-direction: column; gap: 6px; }
        .acotw-card-title { font-size: 19px; color: var(--body-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .acotw-card-artist { font-size: 17px; color: var(--body-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .acotw-card-count { font-size: 17px; color: var(--body-text-muted); min-height: 16px; }

        .acotw-bar-wrap { position: relative; height: 6px; background: var(--body-border); border-radius: 3px; overflow: hidden; }
        .acotw-bar { height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.4s ease; }
        .acotw-bar-pct { position: absolute; right: 0; top: -14px; font-size: 16px; color: var(--body-text-muted); }

        .acotw-vote-btn { width: 100%; justify-content: center; font-size: 18px; padding: 5px 10px; gap: 5px; }
        .acotw-vote-btn--active { background: var(--accent) !important; color: white !important; border-color: var(--accent-dark) !important; }

        /* Archive */
        .acotw-archive-section { border-top: 1px solid var(--body-card-border); padding-top: 20px; }
        .acotw-archive-toggle {
          display: flex; align-items: center; gap: 8px;
          background: none; border: 1px solid var(--body-card-border); border-radius: 6px;
          padding: 8px 14px; font-size: 19px; color: var(--body-text);
          cursor: pointer; transition: background 0.12s;
        }
        .acotw-archive-toggle:hover { background: var(--body-card-bg); transform: none; box-shadow: none; }
        .acotw-archive-count {
          margin-left: 4px; background: var(--accent); color: white;
          font-size: 16px; padding: 1px 6px; border-radius: 10px;
        }
        .acotw-archive-empty { font-size: 20px; color: var(--body-text-muted); padding: 16px 0; }

        .acotw-archive-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px; margin-top: 16px;
        }
        .acotw-archive-card {
          display: flex; gap: 10px; align-items: center;
          background: var(--body-card-bg); border: 1px solid var(--body-card-border);
          border-radius: 6px; padding: 10px; overflow: hidden;
        }
        .acotw-archive-img { width: 48px; height: 48px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
        .acotw-archive-info { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .acotw-archive-week { font-size: 16px; color: #b8860b; text-transform: uppercase; letter-spacing: 0.5px; }
        .acotw-archive-title { font-size: 19px; color: var(--body-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .acotw-archive-artist { font-size: 17px; color: var(--body-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .acotw-archive-votes { display: flex; align-items: center; gap: 4px; font-size: 17px; color: var(--body-text-muted); margin-top: 2px; }
      `}</style>
    </div>
  );
}
