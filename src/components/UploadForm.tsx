import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Loader, AlertCircle, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { computePhash, isDuplicate } from '../lib/phash';
import { checkRateLimit } from '../lib/rateLimit';

const MIN_DIM = 500;
const MAX_DIM = 3000;
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

async function validateFile(file: File): Promise<string | null> {
  if (file.type !== 'image/jpeg') return 'Only JPG/JPEG files are accepted.';
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth < MIN_DIM || img.naturalHeight < MIN_DIM)
        resolve(`Image must be at least ${MIN_DIM}×${MIN_DIM}px (yours: ${img.naturalWidth}×${img.naturalHeight}).`);
      else if (img.naturalWidth > MAX_DIM || img.naturalHeight > MAX_DIM)
        resolve(`Image must be at most ${MAX_DIM}×${MAX_DIM}px (yours: ${img.naturalWidth}×${img.naturalHeight}).`);
      else
        resolve(null);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve('Could not read image dimensions.'); };
    img.src = url;
  });
}

export default function UploadForm() {
  const { user, openAuthModal } = useAuth();
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

  // Bulk mode
  const [bulkItems, setBulkItems] = useState<UploadItem[]>([]);
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [collections, setCollections] = useState<UploadCollection[]>([]);
  const [collectionDraft, setCollectionDraft] = useState<CollectionDraft>({ name: '', isPublic: true });
  const [knownCovers, setKnownCovers] = useState<KnownCover[]>([]);
  const [collectionHint, setCollectionHint] = useState('Drag cover cards into a folder below.');
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    const validationError = await validateFile(f);
    if (validationError) { setError(validationError); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    if (!title.trim()) {
      const inferredTitle = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(inferredTitle);
      applyKnownMetadata(inferredTitle, 'single');
    }
  }, [title, knownCovers]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { openAuthModal('login'); return; }
    if (!file) { setError('Please select a cover image.'); return; }
    if (!title.trim() || !artist.trim()) { setError('Title and artist are required.'); return; }

    if (!checkRateLimit('upload', UPLOAD_RATE_MAX, UPLOAD_RATE_WINDOW)) {
      setError('You\'re uploading too fast. Please wait a minute before uploading more.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const phash = await computePhash(file);
      if (phash && await isDuplicate(phash, supabase)) {
        setError('This image already appears to be in the gallery (duplicate detected).');
        setUploading(false);
        return;
      }

      const fileName = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: storageErr } = await supabase.storage
        .from('covers_cafe_covers')
        .upload(fileName, file, { contentType: 'image/jpeg', upsert: false });

      if (storageErr) throw new Error(storageErr.message);

      const { data: urlData } = supabase.storage.from('covers_cafe_covers').getPublicUrl(fileName);
      const tagsArray = normalizeTags([...tags, tagInput]);

      const { error: insertErr } = await supabase.from('covers_cafe_covers').insert({
        user_id: user.id,
        title: title.trim(),
        artist: artist.trim(),
        year: year ? parseInt(year, 10) : null,
        tags: tagsArray,
        storage_path: fileName,
        image_url: urlData.publicUrl,
        phash: phash || null,
        is_public: true,
      });

      if (insertErr) throw new Error(insertErr.message);
      setSuccess(true);
      setTimeout(() => navigate('/'), 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }

    setUploading(false);
  };

  const handleBulkFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, MAX_BULK - bulkItems.length);
    const newItems: UploadItem[] = [];
    for (const f of arr) {
      const err = await validateFile(f);
      if (err) continue; // silently skip invalid files
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

    if (!checkRateLimit('upload', UPLOAD_RATE_MAX, UPLOAD_RATE_WINDOW)) {
      setBulkItems((prev) => prev.map((it) => ({
        ...it, status: 'error', errorMsg: 'Upload rate limit reached. Wait a minute.',
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
          updateBulkItem(i, { status: 'error', errorMsg: 'Duplicate — already in gallery.' });
          continue;
        }

        const fileName = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { error: storageErr } = await supabase.storage
          .from('covers_cafe_covers')
          .upload(fileName, item.file, { contentType: 'image/jpeg', upsert: false });

        if (storageErr) throw new Error(storageErr.message);

        const { data: urlData } = supabase.storage.from('covers_cafe_covers').getPublicUrl(fileName);

        const { error: insertErr } = await supabase.from('covers_cafe_covers').insert({
          user_id: user.id,
          title: item.title.trim(),
          artist: item.artist.trim(),
          tags: tagsArray,
          storage_path: fileName,
          image_url: urlData.publicUrl,
          phash: phash || null,
          is_public: true,
        });

        if (insertErr) throw new Error(insertErr.message);
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

  if (!user) {
    return (
      <div className="upload-gate card">
        <Upload size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
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
        <CheckCircle size={40} style={{ color: 'var(--accent)', marginBottom: 12 }} />
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
        <CheckCircle size={40} style={{ color: 'var(--accent)', marginBottom: 12 }} />
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
        JPG only &nbsp;·&nbsp; Min {MIN_DIM}×{MIN_DIM}px &nbsp;·&nbsp; Max {MAX_DIM}×{MAX_DIM}px &nbsp;·&nbsp; Square recommended
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
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="upload-drop-inner">
                <Upload size={40} style={{ opacity: 0.4, marginBottom: 10 }} />
                <p className="upload-drop-label">Drag &amp; drop your cover art here</p>
                <span className="btn btn-primary" style={{ marginTop: 8, pointerEvents: 'none' }}>Browse Files</span>
              </div>
            )}
          </div>

          <div className="upload-fields card">
            <div className="form-row">
              <label className="form-label">Album / Cover Title <span style={{ color: 'var(--accent)' }}>*</span></label>
              <input type="text" className="form-input" placeholder="e.g. Dark Side of the Moon" value={title} list="known-titles" onChange={(e) => setTitle(e.target.value)} onBlur={() => applyKnownMetadata(title, 'single')} required />
            </div>
            <div className="form-row">
              <label className="form-label">Artist <span style={{ color: 'var(--accent)' }}>*</span></label>
              <input type="text" className="form-input" placeholder="e.g. Pink Floyd" value={artist} list="known-artists" onChange={(e) => setArtist(e.target.value)} required />
            </div>
            <div className="upload-row-short">
              <div className="form-row">
                <label className="form-label">Year</label>
                <input type="number" className="form-input" placeholder="e.g. 1973" value={year} onChange={(e) => setYear(e.target.value)} min="1900" max="2100" />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">Tags</label>
              <input type="text" className="form-input" placeholder="Type tag, press Enter (Cmd/Ctrl+Enter submits)" value={tagInput} list="known-tags" onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => handleTagKeyDown(e)} />
              <div className="tag-list">{tags.map((tag) => <button key={tag} type="button" className="tag-chip" onClick={() => removeTag(tag)}>{tag} <X size={12} /></button>)}</div>
              <p className="form-hint">Type a word with a comma and press Enter to spend tags fast.</p>
            </div>
            {error && <div className="upload-error"><AlertCircle size={14} /> {error}</div>}
            <div className="upload-actions">
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {uploading ? <><Loader size={14} className="upload-spinner" /> Uploading…</> : <><Upload size={14} /> Submit Cover</>}
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
              <input
                type="text"
                className="form-input"
                placeholder="Type tags and press Enter"
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                onKeyDown={(e) => handleTagKeyDown(e, true)}
              />
              <div className="tag-list">{bulkTags.map((tag) => <button key={tag} type="button" className="tag-chip" onClick={() => removeTag(tag, true)}>{tag} <X size={12} /></button>)}</div>
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
                <Plus size={32} style={{ opacity: 0.4 }} />
                <p className="upload-drop-label">Add JPG covers</p>
                <p className="upload-drop-hint">{bulkItems.length}/{MAX_BULK} added</p>
              </div>
            </div>
          )}

          <div className="upload-fields card">
            <div className="collections-head">
              <strong>Collections (Folders)</strong>
              <div className="collections-plus-box" onClick={() => setCollectionHint('Name your collection and click Create.')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) { handleBulkFiles(e.dataTransfer.files); setCollectionHint('Added dropped files to queue. Now create a folder below.'); } }}>
                <Plus size={18} />
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
              {bulkItems.map((item, idx) => (
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
                      list="known-artists"
                      value={item.artist}
                      onChange={(e) => updateBulkItem(idx, { artist: e.target.value })}
                      disabled={item.status === 'uploading' || item.status === 'done'}
                    />
                    {item.errorMsg && (
                      <p className="bulk-item-error"><AlertCircle size={12} /> {item.errorMsg}</p>
                    )}
                  </div>
                  <div className="bulk-item-status">
                    {item.status === 'uploading' && <Loader size={16} className="upload-spinner" />}
                    {item.status === 'done' && <CheckCircle size={16} style={{ color: 'var(--accent)' }} />}
                    {item.status === 'error' && <AlertCircle size={16} style={{ color: '#c83220' }} />}
                    {(item.status === 'pending' || item.status === 'error') && (
                      <button type="button" className="bulk-item-remove" onClick={() => removeBulkItem(idx)} title="Remove">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {bulkItems.length > 0 && (
            <div className="upload-actions">
              <button type="submit" className="btn btn-primary" disabled={bulkUploading}>
                {bulkUploading
                  ? <><Loader size={14} className="upload-spinner" /> Uploading…</>
                  : <><Upload size={14} /> Upload {bulkItems.length} Cover{bulkItems.length !== 1 ? 's' : ''}</>
                }
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>Cancel</button>
            </div>
          )}
        </form>
      )}

      <datalist id="known-titles">{knownTitles.map((option) => <option key={option} value={option} />)}</datalist>
      <datalist id="known-artists">{knownArtists.map((option) => <option key={option} value={option} />)}</datalist>
      <datalist id="known-tags">{knownTags.map((option) => <option key={option} value={option} />)}</datalist>

      <style>{`
        .upload-page { display: flex; flex-direction: column; gap: 16px; max-width: 700px; }
        .upload-mode-toggle { display: flex; gap: 0; border: 1px solid var(--body-card-border); border-radius: 5px; overflow: hidden; width: fit-content; }
        .upload-mode-btn {
          padding: 8px 18px; font-size: 13px; font-weight: bold;
          background: var(--body-card-bg); color: var(--body-text-muted);
          border: none; cursor: pointer; box-shadow: none;
          transition: background 0.12s, color 0.12s;
        }
        .upload-mode-btn--active { background: var(--accent); color: #fff; }
        .upload-mode-btn:hover:not(.upload-mode-btn--active) { background: var(--sidebar-bg); transform: none; box-shadow: none; }
        .upload-mode-hint { font-size: 11px; opacity: 0.75; }
        .upload-requirements {
          font-size: 12px; color: var(--body-text-muted);
          background: var(--sidebar-bg); padding: 6px 12px;
          border-radius: 4px; border: 1px solid var(--body-card-border);
        }
        .upload-form { display: flex; flex-direction: column; gap: 16px; }
        .upload-gate, .upload-success {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; padding: 50px 40px; max-width: 400px;
        }
        .upload-gate-title { font-size: 20px; font-weight: bold; color: var(--body-text); margin-bottom: 8px; }
        .upload-gate-body { font-size: 14px; color: var(--body-text-muted); line-height: 1.6; }
        .upload-drop-zone {
          border: 3px dashed var(--body-card-border); border-radius: 6px;
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
        .upload-drop-label { font-size: 16px; font-weight: bold; color: var(--body-text); }
        .upload-drop-hint { font-size: 12px; color: var(--body-text-muted); }
        .upload-preview-wrap { position: relative; width: 100%; padding: 16px; display: flex; justify-content: center; }
        .upload-preview-img { max-height: 300px; max-width: 100%; object-fit: contain; border-radius: 4px; box-shadow: var(--shadow-md); }
        .upload-preview-remove {
          position: absolute; top: 8px; right: 8px;
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2);
          color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
          padding: 0;
        }
        .upload-preview-remove:hover { background: rgba(0,0,0,0.85); transform: none; }
        .upload-fields { display: flex; flex-direction: column; gap: 16px; }
        .upload-row-short { display: flex; }
        .upload-row-short .form-input { max-width: 120px; }
        .form-row { display: flex; flex-direction: column; gap: 5px; }
        .form-label { font-size: 13px; font-weight: bold; color: var(--body-text); text-shadow: 0 1px 0 rgba(255,255,255,0.4); }
        [data-theme="dark"] .form-label { text-shadow: none; }
        .form-input {
          width: 100%; padding: 8px 12px;
          border-radius: 4px; border: 1px solid var(--body-card-border);
          background: var(--body-card-bg); color: var(--body-text); font-size: 13px;
          box-shadow: var(--shadow-inset-sm); outline: none; font-family: Arial, Helvetica, sans-serif;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .form-input:focus { border-color: var(--accent); box-shadow: var(--shadow-inset-sm), 0 0 0 2px rgba(192,90,26,0.2); }
        .form-input:disabled { opacity: 0.5; cursor: not-allowed; }
        .form-hint { font-size: 11px; color: var(--body-text-muted); }
        .tag-list { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
        .tag-chip { border: 1px solid var(--body-card-border); background: var(--sidebar-bg); color: var(--body-text); border-radius: 999px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px; }
        .collections-head { display: flex; align-items: center; justify-content: space-between; }
        .collections-plus-box { width: 36px; height: 36px; border: 2px dashed var(--body-card-border); display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; }
        .collections-creator { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; }
        .collection-row { border: 1px solid var(--body-card-border); border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
        .collection-title { font-size: 12px; }
        .collection-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .collection-add { border: 1px solid var(--body-card-border); background: var(--body-card-bg); border-radius: 4px; padding: 3px 6px; }
        .upload-error {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 10px; border-radius: 4px;
          background: rgba(200,50,30,0.1); border: 1px solid rgba(200,50,30,0.3);
          color: #c83220; font-size: 13px;
        }
        .upload-actions { display: flex; gap: 10px; padding-top: 4px; }
        .upload-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .bulk-list { display: flex; flex-direction: column; gap: 10px; }
        .bulk-item {
          display: flex; align-items: center; gap: 12px;
          background: var(--body-card-bg); border: 1px solid var(--body-card-border);
          border-radius: 6px; padding: 10px 12px; box-shadow: var(--shadow-sm);
        }
        .bulk-item--error { border-color: rgba(200,50,30,0.4); background: rgba(200,50,30,0.04); }
        .bulk-item--done { border-color: rgba(50,150,50,0.35); background: rgba(50,150,50,0.04); }
        .bulk-item-thumb { width: 56px; height: 56px; object-fit: cover; border-radius: 4px; flex-shrink: 0; box-shadow: var(--shadow-sm); }
        .bulk-item-fields { flex: 1; display: flex; gap: 8px; flex-wrap: wrap; min-width: 0; }
        .bulk-item-fields .form-input { flex: 1; min-width: 140px; }
        .bulk-item-error { width: 100%; display: flex; align-items: center; gap: 5px; font-size: 11px; color: #c83220; margin-top: 2px; }
        .bulk-item-status { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; }
        .bulk-item-remove {
          display: flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 4px;
          background: rgba(200,50,30,0.1); border: 1px solid rgba(200,50,30,0.25);
          color: #c83220; cursor: pointer; padding: 0;
        }
        .bulk-item-remove:hover { background: rgba(200,50,30,0.2); transform: none; box-shadow: none; }
      `}</style>
    </div>
  );
}
