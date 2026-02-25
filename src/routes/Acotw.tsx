import { useNavigate } from 'react-router-dom';
import { getCoverPath } from '../lib/coverRoutes';
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
  const navigate = useNavigate();
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
    
      {/* HEADER (always visible) */}
      <div className="acotw-header">
        <h1 className="section-title acotw-title-line">
          <span className="acotw-title-chunk">
            <TrophyIcon size={22} />
            <span>Album Cover Of The Week</span>
          </span>
    
          {poll && (
            <span className="acotw-title-chunk">
              Week of {formatWeek(poll.week_start)}
            </span>
          )}
    
          {loading ? (
            <span className="acotw-title-chunk"><LoadingIcon size={16} className="acotw-spinner" /> Loading poll…</span>
          ) : !poll || nominees.length === 0 ? (
            <span className="acotw-title-chunk">
              No poll yet. Favorite some covers to fuel next week’s nominees!
            </span>
          ) : (
            <>
              <span className="acotw-title-chunk">
                <FavoritesIcon size={18} />
                {totalVotes} vote{totalVotes !== 1 ? 's' : ''} cast
              </span>
    
              {!isClosed && !hasVoted && !user && (
                <button
                  className="btn btn-primary acotw-signin-btn"
                  onClick={() => openAuthModal('login')}
                >
                  Sign in to vote
                </button>
              )}
    
              {!isClosed && hasVoted && (
                <span className="acotw-title-chunk">
                  <ClockIcon size={18} />
                  You voted! Results reveal Sunday night.
                </span>
              )}
            </>
          )}
        </h1>
      </div>
    
      {/* BODY (only render when poll exists and not loading) */}
      {!loading && poll && nominees.length > 0 && (
        <>

          {/* Winner banner (closed poll) */}
          {isClosed && poll.winner_cover_id && (() => {
            const winner = nominees.find((n) => n.cover.id === poll.winner_cover_id);
            if (!winner) return null;
          
            return (
              <section className="acotw-winner-section">
                <h2 className="acotw-section-title">This Week’s Winner</h2>
          
                <div className="acotw-winner-grid">
                  <div className="acotw-card acotw-card--winner acotw-card--winner-featured">
                    <div className="acotw-card-img-wrap">
                      <img
                        src={getCoverImageSrc(winner.cover) ?? ''}
                        alt={winner.cover.title}
                        className="acotw-card-img"
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(getCoverPath(winner.cover))}
                      />
                      <div className="acotw-card-winner-overlay">
                        <TrophyIcon size={20} />
                      </div>
                    </div>
          
                    <div className="acotw-card-body">
                      <div className="acotw-card-title">{winner.cover.title}</div>
                      <div className="acotw-card-artist">{winner.cover.artist}</div>
                        {winner.cover.profiles?.username && (
                          <button
                            className="acotw-card-uploader"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/users/${winner.cover.profiles!.username}`);
                            }}
                          >
                            @{winner.cover.profiles.username}
                          </button>
                        )}
                      <div className="acotw-card-count">
                        {winner.vote_count} vote{winner.vote_count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
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
                      <img
                        src={getCoverImageSrc(n.cover)!}
                        alt={n.cover.title}
                        className="acotw-card-img"
                        loading="lazy"
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(getCoverPath(n.cover))}
                      />
                    )}
                    {isWinner && <div className="acotw-card-winner-overlay"><TrophyIcon size={20} /></div>}
                  </div>
                  <div className="acotw-card-body">
                    <div className="acotw-card-title" title={n.cover.title}>{n.cover.title}</div>
                    <div className="acotw-card-artist">{n.cover.artist}</div>
                      {n.cover.profiles?.username && (
                        <button
                          className="acotw-card-uploader"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/users/${n.cover.profiles!.username}`);
                          }}
                        >
                          @{n.cover.profiles.username}
                        </button>
                      )}

                    {/* Vote bar — only visible after user voted or poll closed */}
                    {(hasVoted || isClosed) && (
                      <div className="acotw-bar-wrap" title={`${pct}%`}>
                        <div className="acotw-bar" style={{ width: `${pct}%` }} />
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
        <button className="btn btn-secondary acotw-archive-toggle" onClick={() => setShowArchive((v) => !v)}>
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
                <div key={entry.poll_id} className="acotw-card acotw-archive-card">
                  {entry.cover && getCoverImageSrc(entry.cover) && (
                    <div className="acotw-card-img-wrap">
                      <img
                        src={getCoverImageSrc(entry.cover)!}
                        alt={entry.cover.title}
                        className="acotw-card-img"
                        loading="lazy"
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(getCoverPath(entry.cover!))}
                      />
                    </div>
                  )}
                
                  <div className="acotw-card-body">
                    <div className="acotw-card-title">{entry.cover?.title}</div>
                    <div className="acotw-card-artist">{entry.cover?.artist}</div>
                      {entry.cover?.profiles?.username && (
                        <button
                          className="acotw-card-uploader"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/users/${entry.cover.profiles!.username}`);
                          }}
                        >
                          @{entry.cover.profiles.username}
                        </button>
                      )}
                    <div className="acotw-card-count">
                      {entry.total_votes} vote{entry.total_votes !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      
    </div>
  );
}
