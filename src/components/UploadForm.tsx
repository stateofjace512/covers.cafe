import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function UploadForm() {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [year, setYear] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) { setError('Please select an image file.'); return; }
    if (f.size > 10 * 1024 * 1024) { setError('File is too large. Maximum 10 MB.'); return; }
    setError(null);
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.remove('upload-drop-zone--drag');
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { openAuthModal('login'); return; }
    if (!file) { setError('Please select a cover image.'); return; }
    if (!title.trim() || !artist.trim()) { setError('Title and artist are required.'); return; }

    setUploading(true);
    setError(null);

    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from('covers_cafe_covers')
        .upload(fileName, file, { contentType: file.type, upsert: false });

      if (storageErr) throw new Error(storageErr.message);

      const { data: urlData } = supabase.storage
        .from('covers_cafe_covers')
        .getPublicUrl(fileName);

      const tagsArray = tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const { error: insertErr } = await supabase.from('covers_cafe_covers').insert({
        user_id: user.id,
        title: title.trim(),
        artist: artist.trim(),
        year: year ? parseInt(year, 10) : null,
        tags: tagsArray,
        storage_path: fileName,
        image_url: urlData.publicUrl,
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

  return (
    <form onSubmit={handleSubmit} className="upload-form">
      {/* Drop zone */}
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
          accept="image/*"
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
            <p className="upload-drop-hint">PNG, JPG, WEBP · Max 10 MB · Square recommended</p>
            <span className="btn btn-primary" style={{ marginTop: 8, pointerEvents: 'none' }}>Browse Files</span>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="upload-fields card">
        <div className="form-row">
          <label className="form-label">Album / Cover Title <span style={{ color: 'var(--accent)' }}>*</span></label>
          <input type="text" className="form-input" placeholder="e.g. Dark Side of the Moon" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="form-row">
          <label className="form-label">Artist <span style={{ color: 'var(--accent)' }}>*</span></label>
          <input type="text" className="form-input" placeholder="e.g. Pink Floyd" value={artist} onChange={(e) => setArtist(e.target.value)} required />
        </div>
        <div className="upload-row-short">
          <div className="form-row">
            <label className="form-label">Year</label>
            <input type="number" className="form-input" placeholder="e.g. 1973" value={year} onChange={(e) => setYear(e.target.value)} min="1900" max="2100" />
          </div>
        </div>
        <div className="form-row">
          <label className="form-label">Tags</label>
          <input type="text" className="form-input" placeholder="e.g. rock, psychedelic, 70s" value={tags} onChange={(e) => setTags(e.target.value)} />
          <p className="form-hint">Comma-separated tags.</p>
        </div>

        {error && (
          <div className="upload-error">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="upload-actions">
          <button type="submit" className="btn btn-primary" disabled={uploading}>
            {uploading ? <><Loader size={14} className="upload-spinner" /> Uploading…</> : <><Upload size={14} /> Submit Cover</>}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>Cancel</button>
        </div>
      </div>

      <style>{`
        .upload-form { display: flex; flex-direction: column; gap: 20px; max-width: 640px; }
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
          min-height: 220px; display: flex; align-items: center; justify-content: center;
        }
        .upload-drop-zone:hover, .upload-drop-zone--drag {
          border-color: var(--accent);
          background: linear-gradient(180deg, rgba(192,90,26,0.06) 0%, rgba(192,90,26,0.02) 100%);
        }
        .upload-drop-zone--has-file { border-style: solid; cursor: default; min-height: 300px; }
        .upload-drop-inner {
          display: flex; flex-direction: column; align-items: center;
          gap: 6px; padding: 24px; color: var(--body-text);
        }
        .upload-drop-label { font-size: 16px; font-weight: bold; color: var(--body-text); }
        .upload-drop-hint { font-size: 12px; color: var(--body-text-muted); }
        .upload-preview-wrap { position: relative; width: 100%; padding: 16px; display: flex; justify-content: center; }
        .upload-preview-img { max-height: 300px; max-width: 100%; object-fit: contain; border-radius: 4px; box-shadow: var(--shadow-md); }
        .upload-preview-remove {
          position: absolute; top: 8px; right: 8px;
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2);
          color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
          padding: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.4);
        }
        .upload-preview-remove:hover { background: rgba(0,0,0,0.85); transform: none; }
        .upload-fields { display: flex; flex-direction: column; gap: 16px; }
        .upload-row-short { display: flex; }
        .upload-row-short .form-input { max-width: 120px; }
        .form-row { display: flex; flex-direction: column; gap: 5px; }
        .form-label {
          font-size: 13px; font-weight: bold; color: var(--body-text);
          text-shadow: 0 1px 0 rgba(255,255,255,0.4);
        }
        [data-theme="dark"] .form-label { text-shadow: none; }
        .form-input {
          width: 100%; padding: 8px 12px;
          border-radius: 4px; border: 1px solid var(--body-card-border);
          background: var(--body-card-bg); color: var(--body-text); font-size: 13px;
          box-shadow: var(--shadow-inset-sm); outline: none; font-family: Arial, Helvetica, sans-serif;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .form-input:focus {
          border-color: var(--accent);
          box-shadow: var(--shadow-inset-sm), 0 0 0 2px rgba(192,90,26,0.2);
        }
        .form-hint { font-size: 11px; color: var(--body-text-muted); }
        .upload-error {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 10px; border-radius: 4px;
          background: rgba(200,50,30,0.1); border: 1px solid rgba(200,50,30,0.3);
          color: #c83220; font-size: 13px;
        }
        .upload-actions { display: flex; gap: 10px; padding-top: 4px; }
        .upload-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  );
}
