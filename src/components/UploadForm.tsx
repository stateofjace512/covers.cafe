import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import UploadDownloadIcon from './UploadDownloadIcon';
import XIcon from './XIcon';
import LoadingIcon from './LoadingIcon';
import AlertCircleIcon from './AlertCircleIcon';
import CheckCircleIcon from './CheckCircleIcon';
import PlusIcon from './PlusIcon';
import TrashIcon from './TrashIcon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { computePhash, isDuplicate } from '../lib/phash';
import { checkRateLimit, getRateLimitState } from '../lib/rateLimit';
import InfoModal from './InfoModal';

const MIN_DIM = 500;
const MAX_DIM = 5000;
const MAX_BULK = 10;
const UPLOAD_RATE_MAX = 5;
const UPLOAD_RATE_WINDOW = 60_000; // 1 minute

interface UploadItem {
  file: File;
  preview: string;
  title: string;
  artist: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorMsg?: string;
}



interface KnownCover {
  title: string;
  artist: string;
  tags: string[] | null;
}

interface CollectionDraft {
  name: string;
  isPublic: boolean;
}

interface UploadCollection {
  id: string;
  name: string;
  isPublic: boolean;
  itemIndexes: number[];
}

const normalizeTags = (values: string[]) => Array.from(new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean)));

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  const curr = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    prev.splice(0, b.length + 1, ...curr);
  }
  return prev[b.length];
}

function getFuzzyMatches(value: string, options: string[], maxResults = 2): string[] {
  const typed = value.trim().toLowerCase();
  if (typed.length < 3) return [];
  if (options.some((o) => o.toLowerCase() === typed)) return [];
  if (options.some((o) => o.toLowerCase().startsWith(typed))) return [];
  const maxDist = typed.length <= 5 ? 2 : typed.length <= 10 ? 3 : 4;
  return options
    .map((o) => ({ o, dist: levenshtein(typed, o.toLowerCase()) }))
    .filter(({ dist }) => dist <= maxDist)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, maxResults)
    .map(({ o }) => o);
}

const ARTIST_SPLIT_RE = /\s+(?:feat\.?|ft\.?|with)\s+|\s*[&,]\s*/i;

function detectArtistSplit(value: string): string[] {
  const parts = value.split(ARTIST_SPLIT_RE).map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2 ? parts : [];
}

type ValidationResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; tooLarge: true; width: number; height: number };

async function validateFile(file: File): Promise<ValidationResult> {
  if (file.type !== 'image/jpeg') return { ok: false, error: 'Only JPG/JPEG files are accepted.' };
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth < MIN_DIM || img.naturalHeight < MIN_DIM) {
        resolve({ ok: false, error: `Image must be at least ${MIN_DIM}×${MIN_DIM}px (yours: ${img.naturalWidth}×${img.naturalHeight}).` });
      } else if (img.naturalWidth > MAX_DIM || img.naturalHeight > MAX_DIM) {
        // Don't hard-reject — let the caller offer to resize
        resolve({ ok: false, tooLarge: true, width: img.naturalWidth, height: img.naturalHeight });
      } else {
        resolve({ ok: true });
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ ok: false, error: 'Could not read image dimensions.' }); };
    img.src = url;
  });
}

/**
 * Resize a file so that its largest dimension is floored to the nearest 1000px
 * (e.g. 5001 → 5000, 4039 → 4000, 7800 → 7000). The other dimension scales
 * proportionally. Returns a new JPEG File.
 */
async function resizeToNearestThousand(file: File): Promise<File> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Could not load image for resizing.'));
    img.src = url;
  });
  URL.revokeObjectURL(url);

  const maxDim = Math.max(img.naturalWidth, img.naturalHeight);
  const targetMaxDim = Math.floor(maxDim / 1000) * 1000;
  const scale = targetMaxDim / maxDim;
  const newWidth = Math.round(img.naturalWidth * scale);
  const newHeight = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(img, 0, 0, newWidth, newHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Canvas resize failed'));
    }, 'image/jpeg', 0.92);
  });

  return new File([blob], file.name, { type: 'image/jpeg' });
}

export default function UploadForm() {
  const { user, session, openAuthModal } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  // Single mode
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [year, setYear] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  // File awaiting the user's decision to resize (too-large informodal)
  const [pendingResizeFile, setPendingResizeFile] = useState<File | null>(null);

  // Bulk mode
  const [bulkItems, setBulkItems] = useState<UploadItem[]>([]);
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [collections, setCollections] = useState<UploadCollection[]>([]);
  const [collectionDraft, setCollectionDraft] = useState<CollectionDraft>({ name: '', isPublic: true });
  const [knownCovers, setKnownCovers] = useState<KnownCover[]>([]);
  const [collectionHint, setCollectionHint] = useState('Drag cover cards into a folder below.');
  const [bulkUploading, setBulkUploading] = useState(false);
  // null = no pending confirmation; 'single'/'bulk' = waiting on split-artist confirm
  const [splitConfirmPending, setSplitConfirmPending] = useState<'single' | 'bulk' | null>(null);
  const [bulkDone, setBulkDone] = useState(false);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback((f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    if (!title.trim()) {
      const inferredTitle = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(inferredTitle);
      applyKnownMetadata(inferredTitle, 'single');
    }
  }, [title, knownCovers]);

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    const result = await validateFile(f);
    if (!result.ok) {
      if ('tooLarge' in result) {
        // Offer to resize instead of hard-rejecting
        setPendingResizeFile(f);
        return;
      }
      setError(result.error);
      return;
    }
    acceptFile(f);
  }, [acceptFile]);

  const handleResizeConfirm = useCallback(async () => {
    if (!pendingResizeFile) return;
    try {
      const resized = await resizeToNearestThousand(pendingResizeFile);
      setPendingResizeFile(null);
      acceptFile(resized);
    } catch {
      setPendingResizeFile(null);
      setError('Resize failed. Please try a smaller image.');
    }
  }, [pendingResizeFile, acceptFile]);

  const handleResizeCancel = useCallback(() => {
    setPendingResizeFile(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.remove('upload-drop-zone--drag');
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);


  useEffect(() => {
    const loadKnownMetadata = async () => {
      const { data } = await supabase
        .from('covers_cafe_covers')
        .select('title,artist,tags')
        .limit(400);
      if (data) setKnownCovers(data as KnownCover[]);
    };
    void loadKnownMetadata();
  }, []);

  const knownTitles = useMemo(() => Array.from(new Set(knownCovers.map((c) => c.title))).slice(0, 100), [knownCovers]);
  const knownArtists = useMemo(() => Array.from(new Set(knownCovers.map((c) => c.artist))).slice(0, 100), [knownCovers]);
  const knownTags = useMemo(
    () => Array.from(new Set(knownCovers.flatMap((c) => c.tags ?? []).map((tag) => tag.toLowerCase()))).slice(0, 120),
    [knownCovers],
  );


  const artistFuzzyMatches = useMemo(() => getFuzzyMatches(artist, knownArtists), [artist, knownArtists]);
  const tagFuzzyMatches = useMemo(() => getFuzzyMatches(tagInput, knownTags), [tagInput, knownTags]);
  const bulkTagFuzzyMatches = useMemo(() => getFuzzyMatches(bulkTagInput, knownTags), [bulkTagInput, knownTags]);
  const artistSplitParts = useMemo(() => detectArtistSplit(artist), [artist]);

  const getInlineSuggestion = (value: string, options: string[]) => {
    const typed = value.trim();
    if (!typed) return '';
    const lower = typed.toLowerCase();
    const match = options.find((option) => option.toLowerCase().startsWith(lower));
    if (!match) return '';
    return match.toLowerCase() === lower ? '' : match;
  };

  const titleSuggestion = getInlineSuggestion(title, knownTitles);
  const artistSuggestion = getInlineSuggestion(artist, knownArtists);
  const tagSuggestion = getInlineSuggestion(tagInput, knownTags);
  const bulkTagSuggestion = getInlineSuggestion(bulkTagInput, knownTags);

  const applyKnownMetadata = (nextTitle: string, modeTarget: 'single' | 'bulk', itemIdx?: number) => {
    const match = knownCovers.find((cover) => cover.title.toLowerCase() === nextTitle.trim().toLowerCase());
    if (!match) return;
    if (modeTarget === 'single') {
      setArtist((prev) => prev.trim() ? prev : match.artist);
      setTags((prev) => normalizeTags([...(match.tags ?? []), ...prev]));
      return;
    }
    if (typeof itemIdx !== 'number') return;
    setBulkItems((prev) => prev.map((item, idx) => idx === itemIdx
      ? { ...item, artist: item.artist.trim() ? item.artist : match.artist }
      : item));
    setBulkTags((prev) => normalizeTags([...(match.tags ?? []), ...prev]));
  };

  const addTag = (value: string, isBulk = false) => {
    const cleaned = value.replace(/,$/, '').trim();
    if (!cleaned) return;
    if (isBulk) setBulkTags((prev) => normalizeTags([...prev, cleaned]));
    else setTags((prev) => normalizeTags([...prev, cleaned]));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, isBulk = false) => {
    const value = (isBulk ? bulkTagInput : tagInput).trim();
    if (e.key === 'Enter') {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        if (value) addTag(value, isBulk);
        if (isBulk) void handleBulkSubmit(e as unknown as React.FormEvent);
        else void handleSubmit(e as unknown as React.FormEvent);
        return;
      }
      e.preventDefault();
      if (value || (isBulk ? bulkTagInput : tagInput).endsWith(',')) {
        addTag(value, isBulk);
        if (isBulk) setBulkTagInput('');
        else setTagInput('');
      }
    }

    if (e.key === ',' && value) {
      e.preventDefault();
      addTag(value, isBulk);
      if (isBulk) setBulkTagInput('');
      else setTagInput('');
    }
  };

  const removeTag = (value: string, isBulk = false) => {
    if (isBulk) setBulkTags((prev) => prev.filter((tag) => tag !== value));
    else setTags((prev) => prev.filter((tag) => tag !== value));
  };

  const createCollection = () => {
    const name = collectionDraft.name.trim();
    if (!name) return;
    setCollections((prev) => [...prev, { id: crypto.randomUUID(), name, isPublic: collectionDraft.isPublic, itemIndexes: [] }]);
    setCollectionHint(`Collection "${name}" created. Drag covers into it.`);
    setCollectionDraft({ name: '', isPublic: true });
  };

  const addItemToCollection = (collectionId: string, itemIdx: number) => {
    setCollections((prev) => prev.map((collection) => {
      if (collection.id !== collectionId) return collection;
      if (collection.itemIndexes.includes(itemIdx)) {
        const again = window.confirm('Are you sure you want to add this image to this collection again?');
        if (!again) return collection;
      }
      setCollectionHint(`Added cover #${itemIdx + 1} to ${collection.name}.`);
      return { ...collection, itemIndexes: [...collection.itemIndexes, itemIdx] };
    }));
  };

  const doSingleUpload = async () => {
    if (!user || !file || !session) return;
    if (!checkRateLimit('upload', UPLOAD_RATE_MAX, UPLOAD_RATE_WINDOW)) {
      const { retryAfterMs } = getRateLimitState('upload');
      const waitSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      setError(`You're uploading too fast. Please wait ${waitSeconds}s before trying again.`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const phash = await computePhash(file);
      if (phash && await isDuplicate(phash, supabase)) {
        setError('This image is already in our gallery!');
        setUploading(false);
        return;
      }

      // Step 1: get a one-time direct upload URL from CF (file never touches Netlify)
      const urlRes = await fetch('/api/cf-upload-url', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phash }),
      });
      const urlJson = await urlRes.json() as { ok: boolean; code?: string; uploadUrl?: string; cfImageId?: string; message?: string };
      if (!urlJson.ok || !urlJson.uploadUrl || !urlJson.cfImageId) {
        if (urlJson.code === 'DUPLICATE') throw new Error('This image is already in our gallery!');
        if (urlJson.code === 'OFFICIAL_BLOCKED') throw new Error('This image is not allowed on our site. Read our Terms: /terms');
        throw new Error(urlJson.message ?? 'Could not get upload URL');
      }

      // Step 2: upload file directly to Cloudflare (bypasses Netlify size limit)
      // Explicitly set content-type so CF doesn't reject files with an empty File.type
      const cfForm = new FormData();
      cfForm.append('file', file.slice(0, file.size, file.type || 'image/jpeg'), file.name || 'cover.jpg');
      const cfRes = await fetch(urlJson.uploadUrl, { method: 'POST', body: cfForm });
      if (!cfRes.ok) {
        const cfErr = await cfRes.json().catch(() => null) as { errors?: Array<{ message?: string }> } | null;
        throw new Error(cfErr?.errors?.[0]?.message ?? 'Image upload to Cloudflare failed');
      }

      // Step 3: save metadata to DB via our server (tiny JSON payload)
      const tagsArray = normalizeTags([...tags, tagInput]);
      const res = await fetch('/api/upload-cover', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cfImageId: urlJson.cfImageId,
          title: title.trim(),
          artist: artist.trim(),
          year: year ? parseInt(year, 10) : undefined,
          tags: tagsArray,
          phash: phash ?? undefined,
        }),
      });
      const json = await res.json() as { ok: boolean; code?: string; message?: string };
      if (!json.ok) {
        if (json.code === 'DUPLICATE') throw new Error('This image is already in our gallery!');
        if (json.code === 'OFFICIAL_BLOCKED') throw new Error('This image is not allowed on our site. Read our Terms: /terms');
        throw new Error(json.message ?? 'Upload failed');
      }

      setSuccess(true);
      setTimeout(() => navigate('/'), 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { openAuthModal('login'); return; }
    if (!file) { setError('Please select a cover image.'); return; }
    if (!title.trim() || !artist.trim()) { setError('Title and artist are required.'); return; }
    // Gate: ask about multiple artists before committing
    if (artistSplitParts.length >= 2) {
      setSplitConfirmPending('single');
      return;
    }
    await doSingleUpload();
  };

  const handleBulkFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, MAX_BULK - bulkItems.length);
    const newItems: UploadItem[] = [];
    for (let f of arr) {
      const result = await validateFile(f);
      if (!result.ok) {
        if ('tooLarge' in result) {
          // Auto-resize oversized files in bulk mode — no modal interruption
          try { f = await resizeToNearestThousand(f); } catch { continue; }
        } else {
          continue; // skip invalid (wrong type, too small, etc.)
        }
      }
      newItems.push({
        file: f,
        preview: URL.createObjectURL(f),
        title: f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
        artist: '',
        status: 'pending',
      });
    }
    setBulkItems((prev) => {
      const next = [...prev, ...newItems].slice(0, MAX_BULK);
      return next.map((item) => {
        const match = knownCovers.find((cover) => cover.title.toLowerCase() === item.title.toLowerCase());
        if (!match) return item;
        return { ...item, artist: item.artist || match.artist };
      });
    });
  };

  const updateBulkItem = (idx: number, patch: Partial<UploadItem>) => {
    setBulkItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const removeBulkItem = (idx: number) => {
    setBulkItems((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].preview);
      next.splice(idx, 1);
      return next;
    });
  };

  const doBulkUpload = async () => {
    if (!user || !session) return;
    if (!checkRateLimit('upload', UPLOAD_RATE_MAX, UPLOAD_RATE_WINDOW)) {
      const { retryAfterMs } = getRateLimitState('upload');
      const waitSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      setBulkItems((prev) => prev.map((it) => ({
        ...it, status: 'error', errorMsg: `Upload rate limit reached. Try again in ${waitSeconds}s.`,
      })));
      return;
    }
    setBulkUploading(true);
    const tagsArray = normalizeTags([...bulkTags, bulkTagInput]);

    for (let i = 0; i < bulkItems.length; i++) {
      const item = bulkItems[i];
      if (item.status === 'done') continue;
      updateBulkItem(i, { status: 'uploading' });

      try {
        const phash = await computePhash(item.file);
        if (phash && await isDuplicate(phash, supabase)) {
          updateBulkItem(i, { status: 'error', errorMsg: 'This image is already in our gallery!' });
          continue;
        }

        // Step 1: get a one-time direct upload URL
        const urlRes = await fetch('/api/cf-upload-url', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ phash }),
        });
        const urlJson = await urlRes.json() as { ok: boolean; code?: string; uploadUrl?: string; cfImageId?: string; message?: string };
        if (!urlJson.ok || !urlJson.uploadUrl || !urlJson.cfImageId) {
          if (urlJson.code === 'DUPLICATE') throw new Error('This image is already in our gallery!');
          if (urlJson.code === 'OFFICIAL_BLOCKED') throw new Error('This image is not allowed on our site. Read our Terms: /terms');
          throw new Error(urlJson.message ?? 'Could not get upload URL');
        }

        // Step 2: upload directly to Cloudflare
        const cfForm = new FormData();
        cfForm.append('file', item.file.slice(0, item.file.size, item.file.type || 'image/jpeg'), item.file.name || 'cover.jpg');
        const cfRes = await fetch(urlJson.uploadUrl, { method: 'POST', body: cfForm });
        if (!cfRes.ok) {
          const cfErr = await cfRes.json().catch(() => null) as { errors?: Array<{ message?: string }> } | null;
          throw new Error(cfErr?.errors?.[0]?.message ?? 'Image upload to Cloudflare failed');
        }

        // Step 3: save metadata
        const res = await fetch('/api/upload-cover', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cfImageId: urlJson.cfImageId,
            title: item.title.trim(),
            artist: item.artist.trim(),
            tags: tagsArray,
            phash: phash ?? undefined,
          }),
        });
        const json = await res.json() as { ok: boolean; code?: string; message?: string };
        if (!json.ok) {
          if (json.code === 'DUPLICATE') throw new Error('This image is already in our gallery!');
          if (json.code === 'OFFICIAL_BLOCKED') throw new Error('This image is not allowed on our site. Read our Terms: /terms');
          throw new Error(json.message ?? 'Upload failed');
        }

        updateBulkItem(i, { status: 'done' });
      } catch (err: unknown) {
        updateBulkItem(i, {
          status: 'error',
          errorMsg: err instanceof Error ? err.message : 'Upload failed',
        });
      }
    }

    setBulkUploading(false);
    setBulkDone(true);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { openAuthModal('login'); return; }
    if (!bulkItems.length) return;
    const hasInvalid = bulkItems.some((it) => !it.title.trim() || !it.artist.trim());
    if (hasInvalid) {
      setBulkItems((prev) => prev.map((it) =>
        !it.title.trim() || !it.artist.trim()
          ? { ...it, status: 'error', errorMsg: 'Title and artist required' }
          : it
      ));
      return;
    }
    // Gate: ask about multiple artists before committing
    const hasMultiArtist = bulkItems.some((it) => it.status === 'pending' && detectArtistSplit(it.artist).length >= 2);
    if (hasMultiArtist) {
      setSplitConfirmPending('bulk');
      return;
    }
    await doBulkUpload();
  };

  const completeIfSuggested = (
    e: React.KeyboardEvent<HTMLInputElement>,
    suggestion: string,
    apply: (value: string) => void,
  ) => {
    if (e.key !== 'Tab' || !suggestion) return;
    e.preventDefault();
    apply(suggestion);
  };

  if (!user) {
    return (
      <div className="upload-gate card">
        <UploadDownloadIcon size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
        <h2 className="upload-gate-title">Sign in to Upload</h2>
        <p className="upload-gate-body">Create a free account to share your album cover art with the community.</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn btn-primary" onClick={() => openAuthModal('register')}>Create Account</button>
          <button className="btn btn-secondary" onClick={() => openAuthModal('login')}>Sign In</button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="upload-success card">
        <CheckCircleIcon size={40} style={{ color: 'var(--accent)', marginBottom: 12 }} />
        <h2 className="upload-gate-title">Cover Uploaded!</h2>
        <p className="upload-gate-body">Redirecting to gallery…</p>
      </div>
    );
  }

  if (bulkDone) {
    const successCount = bulkItems.filter((it) => it.status === 'done').length;
    const errCount = bulkItems.filter((it) => it.status === 'error').length;
    return (
      <div className="upload-success card">
        <CheckCircleIcon size={40} style={{ color: 'var(--accent)', marginBottom: 12 }} />
        <h2 className="upload-gate-title">Bulk Upload Complete</h2>
        <p className="upload-gate-body">
          {successCount} cover{successCount !== 1 ? 's' : ''} uploaded{errCount > 0 ? `, ${errCount} failed` : ''}.
        </p>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
          Go to Gallery
        </button>
      </div>
    );
  }

  return (
    <div className="upload-page">
      {pendingResizeFile && (
        <InfoModal
          emoji="💪"
          title="Woah there!"
          body="That file is too powerful for us. Try uploading a smaller version or we can resize it for you!"
          primaryLabel="Resize for me"
          onPrimary={handleResizeConfirm}
          secondaryLabel="Cancel"
          onSecondary={handleResizeCancel}
          onClose={handleResizeCancel}
        />
      )}
      {splitConfirmPending && (
        <InfoModal
          emoji="🎤"
          title="Separate these artists?"
          body={
            splitConfirmPending === 'single'
              ? <>
                  {artistSplitParts.map((p) => <span key={p} className="fuzzy-hint-tag" style={{ marginRight: 4 }}>{p}</span>)}
                  <br /><br />
                  Do you want to split these into separate artist links? If this is a group or duo name, tap Edit and retype it without a separator.
                </>
              : <>
                  One or more uploads has multiple artists detected. Do you want to split them into separate artist links? If any are group or duo names, tap Edit and retype without a separator.
                </>
          }
          primaryLabel="Yes, separate them"
          onPrimary={() => {
            setSplitConfirmPending(null);
            if (splitConfirmPending === 'single') void doSingleUpload();
            else void doBulkUpload();
          }}
          secondaryLabel="Edit"
          onSecondary={() => setSplitConfirmPending(null)}
          onClose={() => setSplitConfirmPending(null)}
        />
      )}
      <div className="upload-mode-toggle">
        <button
          className={`upload-mode-btn${mode === 'single' ? ' upload-mode-btn--active' : ''}`}
          onClick={() => setMode('single')}
        >
          Single Upload
        </button>
        <button
          className={`upload-mode-btn${mode === 'bulk' ? ' upload-mode-btn--active' : ''}`}
          onClick={() => setMode('bulk')}
        >
          Bulk Upload <span className="upload-mode-hint">(up to {MAX_BULK})</span>
        </button>
      </div>

      <p className="upload-requirements">
        <AlertCircleIcon size={13} /> JPG · {MIN_DIM}×{MIN_DIM}px min · Square preferred · Full-res stored
      </p>

      {mode === 'single' && (
        <form onSubmit={handleSubmit} className="upload-form">
          <div
            ref={dropRef}
            className={`upload-drop-zone${file ? ' upload-drop-zone--has-file' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add('upload-drop-zone--drag'); }}
            onDragLeave={() => dropRef.current?.classList.remove('upload-drop-zone--drag')}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {preview ? (
              <div className="upload-preview-wrap">
                <img src={preview} alt="Preview" className="upload-preview-img" />
                <button
                  type="button"
                  className="upload-preview-remove"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                  title="Remove"
                >
                  <XIcon size={14} />
                </button>
              </div>
            ) : (
              <div className="upload-drop-inner">
                <UploadDownloadIcon size={40} style={{ opacity: 0.4, marginBottom: 10 }} />
                <p className="upload-drop-label">Drag &amp; drop your cover art here</p>
                <span className="btn btn-primary" style={{ marginTop: 8, pointerEvents: 'none' }}>Browse Files</span>
              </div>
            )}
          </div>

          <div className="upload-fields card">
            <div className="form-row">
              <label className="form-label">Album / Cover Title <span style={{ color: 'var(--accent)' }}>*</span></label>
              <div className="autocomplete-field">
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Dark Side of the Moon"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => completeIfSuggested(e, titleSuggestion, setTitle)}
                  onBlur={() => applyKnownMetadata(title, 'single')}
                  required
                />
                {titleSuggestion && <div className="autocomplete-hint">↹ Tab to complete: {titleSuggestion}</div>}
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">Artist <span style={{ color: 'var(--accent)' }}>*</span></label>
              <div className="autocomplete-field">
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Pink Floyd"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  onKeyDown={(e) => completeIfSuggested(e, artistSuggestion, setArtist)}
                  required
                />
                {artistSuggestion && <div className="autocomplete-hint">↹ Tab to complete: {artistSuggestion}</div>}
                {!artistSuggestion && artistFuzzyMatches.length > 0 && (
                  <div className="fuzzy-hint">
                    Did you mean{' '}
                    {artistFuzzyMatches.map((m, i) => (
                      <span key={m}>
                        <button type="button" className="fuzzy-hint-btn" onClick={() => setArtist(m)}>{m}</button>
                        {i < artistFuzzyMatches.length - 1 ? ' or ' : '?'}
                      </span>
                    ))}
                  </div>
                )}
                {artistSplitParts.length >= 2 && (
                  <div className="fuzzy-hint fuzzy-hint--split">
                    Multiple artists detected:{' '}
                    {artistSplitParts.map((p) => <span key={p} className="fuzzy-hint-tag">{p}</span>)}
                    {' '}— each will link to their own artist page.
                  </div>
                )}
              </div>
            </div>
            <div className="upload-row-short">
              <div className="form-row">
                <label className="form-label">Year</label>
                <input type="number" className="form-input" placeholder="e.g. 1973" value={year} onChange={(e) => setYear(e.target.value)} min="1900" max="2100" />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">Tags</label>
              <div className="autocomplete-field">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Type tag, press Enter (Cmd/Ctrl+Enter submits)"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    completeIfSuggested(e, tagSuggestion, setTagInput);
                    handleTagKeyDown(e);
                  }}
                />
                {tagSuggestion && <div className="autocomplete-hint">↹ Tab to complete: {tagSuggestion}</div>}
                {!tagSuggestion && tagFuzzyMatches.length > 0 && (
                  <div className="fuzzy-hint">
                    Did you mean{' '}
                    {tagFuzzyMatches.map((m, i) => (
                      <span key={m}>
                        <button type="button" className="fuzzy-hint-btn" onClick={() => setTagInput(m)}>{m}</button>
                        {i < tagFuzzyMatches.length - 1 ? ' or ' : '?'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="tag-list">{tags.map((tag) => <button key={tag} type="button" className="tag-chip" onClick={() => removeTag(tag)}>{tag} <XIcon size={12} /></button>)}</div>
              <p className="form-hint">Type a word with a comma and press Enter to spend tags fast.</p>
            </div>
            {error && <div className="upload-error"><AlertCircleIcon size={14} /> {error}</div>}
            <div className="upload-actions">
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {uploading ? <><LoadingIcon size={14} className="upload-spinner" /> Uploading…</> : <><UploadDownloadIcon size={14} /> Submit Cover</>}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      {mode === 'bulk' && (
        <form onSubmit={handleBulkSubmit} className="upload-form">
          <div className="upload-fields card" style={{ marginBottom: 0 }}>
            <div className="form-row">
              <label className="form-label">
                Shared Tags <span className="form-hint" style={{ fontWeight: 'normal' }}>(applied to all covers in this batch)</span>
              </label>
              <div className="autocomplete-field">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Type tags and press Enter"
                  value={bulkTagInput}
                  onChange={(e) => setBulkTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    completeIfSuggested(e, bulkTagSuggestion, setBulkTagInput);
                    handleTagKeyDown(e, true);
                  }}
                />
                {bulkTagSuggestion && <div className="autocomplete-hint">↹ Tab to complete: {bulkTagSuggestion}</div>}
                {!bulkTagSuggestion && bulkTagFuzzyMatches.length > 0 && (
                  <div className="fuzzy-hint">
                    Did you mean{' '}
                    {bulkTagFuzzyMatches.map((m, i) => (
                      <span key={m}>
                        <button type="button" className="fuzzy-hint-btn" onClick={() => setBulkTagInput(m)}>{m}</button>
                        {i < bulkTagFuzzyMatches.length - 1 ? ' or ' : '?'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="tag-list">{bulkTags.map((tag) => <button key={tag} type="button" className="tag-chip" onClick={() => removeTag(tag, true)}>{tag} <XIcon size={12} /></button>)}</div>
            </div>
          </div>

          {bulkItems.length < MAX_BULK && (
            <div
              className="upload-drop-zone bulk-drop-zone"
              onClick={() => bulkInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleBulkFiles(e.dataTransfer.files); }}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                ref={bulkInputRef}
                type="file"
                accept="image/jpeg"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => { if (e.target.files) handleBulkFiles(e.target.files); }}
              />
              <div className="upload-drop-inner">
                <PlusIcon size={32} style={{ opacity: 0.4 }} />
                <p className="upload-drop-label">Add JPG covers</p>
                <p className="upload-drop-hint">{bulkItems.length}/{MAX_BULK} added</p>
              </div>
            </div>
          )}

          <div className="upload-fields card">
            <div className="collections-head">
              <strong>Collections (Folders)</strong>
              <div className="collections-plus-box" onClick={() => setCollectionHint('Name your collection and click Create.')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) { handleBulkFiles(e.dataTransfer.files); setCollectionHint('Added dropped files to queue. Now create a folder below.'); } }}>
                <PlusIcon size={18} />
              </div>
            </div>
            <p className="form-hint">{collectionHint}</p>
            <div className="collections-creator">
              <input className="form-input" placeholder="Name your collection" value={collectionDraft.name} onChange={(e) => setCollectionDraft((prev) => ({ ...prev, name: e.target.value }))} />
              <button type="button" className="btn btn-secondary" onClick={() => setCollectionDraft((prev) => ({ ...prev, isPublic: !prev.isPublic }))}>{collectionDraft.isPublic ? 'Public' : 'Private'}</button>
              <button type="button" className="btn btn-primary" onClick={createCollection}>Create</button>
            </div>
            {collections.map((collection) => (
              <div
                key={collection.id}
                className="collection-row"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const idx = Number(e.dataTransfer.getData('text/bulk-index'));
                  if (!Number.isNaN(idx)) addItemToCollection(collection.id, idx);
                }}
              >
                <div className="collection-title">📁 {collection.name} · {collection.isPublic ? 'Public' : 'Private'}</div>
                <div className="form-hint">Drop a cover here, or click quick-add:</div>
                <div className="collection-actions">
                  {bulkItems.map((_, idx) => (
                    <button key={`${collection.id}-${idx}`} type="button" className="collection-add" onClick={() => addItemToCollection(collection.id, idx)}>+ #{idx + 1}</button>
                  ))}
                </div>
                <div className="form-hint">{collection.itemIndexes.length} image(s) in this folder.</div>
              </div>
            ))}
          </div>

          {bulkItems.length > 0 && (
            <div className="bulk-list">
              {bulkItems.map((item, idx) => {
                const bulkArtistFuzzy = item.artist.trim().length >= 3 ? getFuzzyMatches(item.artist, knownArtists) : [];
                const bulkArtistSplit = detectArtistSplit(item.artist);
                return (
                <div
                  key={idx}
                  className={`bulk-item${item.status === 'error' ? ' bulk-item--error' : item.status === 'done' ? ' bulk-item--done' : ''}`}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/bulk-index', String(idx))}
                >
                  <img src={item.preview} alt="" className="bulk-item-thumb" />
                  <div className="bulk-item-fields">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Album / Cover Title *"
                      value={item.title}
                      onChange={(e) => updateBulkItem(idx, { title: e.target.value })}
                      onBlur={() => applyKnownMetadata(item.title, 'bulk', idx)}
                      disabled={item.status === 'uploading' || item.status === 'done'}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Artist *"
                      value={item.artist}
                      onChange={(e) => updateBulkItem(idx, { artist: e.target.value })}
                      disabled={item.status === 'uploading' || item.status === 'done'}
                    />
                    {bulkArtistFuzzy.length > 0 && item.status === 'pending' && (
                      <div className="fuzzy-hint" style={{ width: '100%' }}>
                        Did you mean{' '}
                        {bulkArtistFuzzy.map((m, i) => (
                          <span key={m}>
                            <button type="button" className="fuzzy-hint-btn" onClick={() => updateBulkItem(idx, { artist: m })}>{m}</button>
                            {i < bulkArtistFuzzy.length - 1 ? ' or ' : '?'}
                          </span>
                        ))}
                      </div>
                    )}
                    {bulkArtistSplit.length >= 2 && item.status === 'pending' && (
                      <div className="fuzzy-hint fuzzy-hint--split" style={{ width: '100%' }}>
                        Multiple artists:{' '}
                        {bulkArtistSplit.map((p) => <span key={p} className="fuzzy-hint-tag">{p}</span>)}
                        {' '}— each will link to their own artist page.
                      </div>
                    )}
                    {item.errorMsg && (
                      <p className="bulk-item-error"><AlertCircleIcon size={12} /> {item.errorMsg}</p>
                    )}
                  </div>
                  <div className="bulk-item-status">
                    {item.status === 'uploading' && <LoadingIcon size={16} className="upload-spinner" />}
                    {item.status === 'done' && <CheckCircleIcon size={16} style={{ color: 'var(--accent)' }} />}
                    {item.status === 'error' && <AlertCircleIcon size={16} style={{ color: '#c83220' }} />}
                    {(item.status === 'pending' || item.status === 'error') && (
                      <button type="button" className="bulk-item-remove" onClick={() => removeBulkItem(idx)} title="Remove">
                        <TrashIcon size={14} />
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {bulkItems.length > 0 && (
            <div className="upload-actions">
              <button type="submit" className="btn btn-primary" disabled={bulkUploading}>
                {bulkUploading
                  ? <><LoadingIcon size={14} className="upload-spinner" /> Uploading…</>
                  : <><UploadDownloadIcon size={14} /> Upload {bulkItems.length} Cover{bulkItems.length !== 1 ? 's' : ''}</>
                }
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>Cancel</button>
            </div>
          )}
        </form>
      )}


      <style>{`
        .upload-page { display: flex; flex-direction: column; gap: 16px; max-width: 700px; }
        .upload-mode-toggle { display: flex; gap: 0; border: 1px solid var(--body-card-border); border-radius: 0; overflow: hidden; width: fit-content; }
        .upload-mode-btn {
          padding: 8px 18px; font-size: 19px;
          background: var(--body-card-bg); color: var(--body-text-muted);
          border: none; cursor: pointer; box-shadow: none;
          transition: background 0.12s, color 0.12s;
        }
        .upload-mode-btn--active { background: var(--accent); color: #fff; }
        .upload-mode-btn:hover:not(.upload-mode-btn--active) { background: var(--sidebar-bg); transform: none; box-shadow: none; }
        .upload-mode-hint { font-size: 17px; opacity: 0.75; }
        .upload-requirements {
          font-size: 18px; color: var(--body-text-muted);
          background: var(--sidebar-bg); padding: 6px 12px;
          border-radius: 0; border: 1px solid var(--body-card-border);
          display: flex; align-items: center; gap: 6px;
        }
        .upload-form { display: flex; flex-direction: column; gap: 16px; }
        .upload-gate, .upload-success {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; padding: 50px 40px; max-width: 400px;
        }
        .upload-gate-title { font-size: 23px; color: var(--body-text); margin-bottom: 8px; }
        .upload-gate-body { font-size: 20px; color: var(--body-text-muted); line-height: 1.6; }
        .upload-drop-zone {
          border: 3px dashed var(--body-card-border); border-radius: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.04) 100%);
          box-shadow: var(--shadow-inset); cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          min-height: 180px; display: flex; align-items: center; justify-content: center;
        }
        .upload-drop-zone:hover, .upload-drop-zone--drag {
          border-color: var(--accent);
          background: linear-gradient(180deg, rgba(192,90,26,0.06) 0%, rgba(192,90,26,0.02) 100%);
        }
        .upload-drop-zone--has-file { border-style: solid; cursor: default; min-height: 300px; }
        .bulk-drop-zone { min-height: 100px; }
        .upload-drop-inner { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 24px; color: var(--body-text); }
        .upload-drop-label { font-size: 19px; color: var(--body-text); }
        .upload-drop-hint { font-size: 18px; color: var(--body-text-muted); }
        .upload-preview-wrap { position: relative; width: 100%; padding: 16px; display: flex; justify-content: center; }
        .upload-preview-img { max-height: 300px; max-width: 100%; object-fit: contain; border-radius: 0; box-shadow: var(--shadow-md); }
        .upload-preview-remove {
          position: absolute; top: 8px; right: 8px;
          width: 28px; height: 28px; border-radius: 0;
          background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2);
          color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
          padding: 0;
        }
        .upload-preview-remove:hover { background: rgba(0,0,0,0.85); transform: none; }
        .upload-fields { display: flex; flex-direction: column; gap: 16px; }
        .upload-row-short { display: flex; }
        .upload-row-short .form-input { max-width: 120px; }
        .form-row { display: flex; flex-direction: column; gap: 5px; }
        .form-label { font-size: 19px; color: var(--body-text); }
        [data-theme="dark"] .form-label { }
        .form-input {
          width: 100%; padding: 8px 12px;
          border-radius: 0; border: 1px solid var(--body-card-border);
          background: var(--body-card-bg); color: var(--body-text); font-size: 19px;
          box-shadow: var(--shadow-inset-sm); outline: none; font-family: var(--font-body);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .form-input:focus { border-color: var(--accent); box-shadow: var(--shadow-inset-sm), 0 0 0 2px rgba(192,90,26,0.2); }
        .autocomplete-field { display: flex; flex-direction: column; gap: 4px; }
        .autocomplete-hint { font-size: 17px; color: var(--body-text-muted); opacity: 0.9; }
        .form-input:disabled { opacity: 0.5; cursor: not-allowed; }
        .form-hint { font-size: 17px; color: var(--body-text-muted); }
        .tag-list { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
        .tag-chip { border: 1px solid var(--body-card-border); background: var(--sidebar-bg); color: var(--body-text); border-radius: 0; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px; }
        .collections-head { display: flex; align-items: center; justify-content: space-between; }
        .collections-plus-box { width: 36px; height: 36px; border: 2px dashed var(--body-card-border); display: flex; align-items: center; justify-content: center; border-radius: 0; cursor: pointer; }
        .collections-creator { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; }
        .collection-row { border: 1px solid var(--body-card-border); border-radius: 0; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
        .collection-title { font-size: 18px; }
        .collection-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .collection-add { border: 1px solid var(--body-card-border); background: var(--body-card-bg); border-radius: 0; padding: 3px 6px; }
        .upload-error {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 10px; border-radius: 0;
          background: rgba(200,50,30,0.1); border: 1px solid rgba(200,50,30,0.3);
          color: #c83220; font-size: 19px;
        }
        .upload-actions { display: flex; gap: 10px; padding-top: 4px; }
        .upload-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .bulk-list { display: flex; flex-direction: column; gap: 10px; }
        .bulk-item {
          display: flex; align-items: center; gap: 12px;
          background: var(--body-card-bg); border: 1px solid var(--body-card-border);
          border-radius: 0; padding: 10px 12px; box-shadow: var(--shadow-sm);
        }
        .bulk-item--error { border-color: rgba(200,50,30,0.4); background: rgba(200,50,30,0.04); }
        .bulk-item--done { border-color: rgba(50,150,50,0.35); background: rgba(50,150,50,0.04); }
        .bulk-item-thumb { width: 56px; height: 56px; object-fit: cover; border-radius: 0; flex-shrink: 0; box-shadow: var(--shadow-sm); }
        .bulk-item-fields { flex: 1; display: flex; gap: 8px; flex-wrap: wrap; min-width: 0; }
        .bulk-item-fields .form-input { flex: 1; min-width: 140px; }
        .bulk-item-error { width: 100%; display: flex; align-items: center; gap: 5px; font-size: 17px; color: #c83220; margin-top: 2px; }
        .bulk-item-status { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; }
        .bulk-item-remove {
          display: flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 0;
          background: rgba(200,50,30,0.1); border: 1px solid rgba(200,50,30,0.25);
          color: #c83220; cursor: pointer; padding: 0;
        }
        .bulk-item-remove:hover { background: rgba(200,50,30,0.2); transform: none; box-shadow: none; }
        .fuzzy-hint {
          font-size: 17px; color: var(--body-text-muted);
          display: flex; flex-wrap: wrap; align-items: center; gap: 3px;
        }
        .fuzzy-hint--split {
          background: rgba(192,90,26,0.08); border: 1px solid rgba(192,90,26,0.25);
          border-radius: 0; padding: 4px 8px; color: var(--body-text);
        }
        .fuzzy-hint-btn {
          background: none; border: none; padding: 0;
          color: var(--accent); font-size: 17px; cursor: pointer;
          font-family: var(--font-body); text-decoration: underline;
          text-underline-offset: 2px;
        }
        .fuzzy-hint-btn:hover { opacity: 0.75; transform: none; box-shadow: none; }
        .fuzzy-hint-tag {
          display: inline-block; background: var(--sidebar-bg);
          border: 1px solid var(--body-card-border); border-radius: 0;
          padding: 1px 6px; font-size: 16px; margin: 0 2px;
        }
      `}</style>
    </div>
  );
}
