import { useEffect, useRef, useState } from 'react';

interface MenuItem {
  label: string;
  action: () => void;
  separator?: false;
}
interface MenuSeparator {
  separator: true;
}
type MenuEntry = MenuItem | MenuSeparator;

interface MenuState {
  x: number;
  y: number;
  items: MenuEntry[];
}

function isSeparator(entry: MenuEntry): entry is MenuSeparator {
  return 'separator' in entry && entry.separator === true;
}

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

export default function ContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleContext = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const items: MenuEntry[] = [];

      // Check for official cover card
      const officialCard = target.closest('[data-official-url]') as HTMLElement | null;
      if (officialCard) {
        const url = officialCard.dataset.officialUrl ?? '';
        const artist = officialCard.dataset.artistName ?? '';
        const album = officialCard.dataset.albumTitle ?? '';
        items.push({ label: 'Open image', action: () => window.open(url, '_blank', 'noopener,noreferrer') });
        items.push({ label: 'Copy image URL', action: () => copyToClipboard(url) });
        if (artist) {
          items.push({ separator: true });
          items.push({ label: `Copy artist: ${artist}`, action: () => copyToClipboard(artist) });
        }
        if (album) {
          items.push({ label: `Copy title: ${album}`, action: () => copyToClipboard(album) });
        }
        items.push({ separator: true });
        items.push({ label: 'Copy page URL', action: () => copyToClipboard(window.location.href) });

        e.preventDefault();
        showMenu(e.clientX, e.clientY, items);
        return;
      }

      // Check for fan cover card
      const coverCard = target.closest('[data-cover-id]') as HTMLElement | null;
      if (coverCard) {
        const coverSlug = coverCard.dataset.coverSlug ?? '';
        const coverArtist = coverCard.dataset.coverArtist ?? '';
        const imgUrl = coverCard.dataset.coverImg ?? '';
        if (coverSlug) items.push({ label: 'Open cover page', action: () => window.open(`/cover/${coverSlug}`, '_blank') });
        if (imgUrl) items.push({ label: 'Copy image URL', action: () => copyToClipboard(imgUrl) });
        if (coverArtist) items.push({ label: `Copy artist: ${coverArtist}`, action: () => copyToClipboard(coverArtist) });
        items.push({ separator: true });
        items.push({ label: 'Copy page URL', action: () => copyToClipboard(window.location.href) });

        e.preventDefault();
        showMenu(e.clientX, e.clientY, items);
        return;
      }

      // Check for standalone img
      const img = target.closest('img') as HTMLImageElement | null;
      if (img?.src && !img.src.startsWith('data:')) {
        items.push({ label: 'Open image in new tab', action: () => window.open(img.src, '_blank', 'noopener,noreferrer') });
        items.push({ label: 'Copy image URL', action: () => copyToClipboard(img.src) });
        items.push({ separator: true });
        items.push({ label: 'Copy page URL', action: () => copyToClipboard(window.location.href) });

        e.preventDefault();
        showMenu(e.clientX, e.clientY, items);
        return;
      }

      // Fallback: only show if user right-clicks something in the app body
      const inAppBody = target.closest('.site-main, .sidebar, header');
      if (inAppBody) {
        items.push({ label: 'Copy page URL', action: () => copyToClipboard(window.location.href) });
        e.preventDefault();
        showMenu(e.clientX, e.clientY, items);
      }
    };

    const showMenu = (x: number, y: number, items: MenuEntry[]) => {
      if (!items.length) return;
      // Clamp so menu doesn't overflow viewport
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const menuW = 220;
      const menuH = items.length * 34 + 8;
      setMenu({
        x: Math.min(x, vw - menuW - 8),
        y: Math.min(y, vh - menuH - 8),
        items,
      });
    };

    const handleClose = () => setMenu(null);

    document.addEventListener('contextmenu', handleContext);
    document.addEventListener('click', handleClose);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') handleClose(); });
    window.addEventListener('scroll', handleClose, { passive: true });

    return () => {
      document.removeEventListener('contextmenu', handleContext);
      document.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose);
    };
  }, []);

  if (!menu) return null;

  return (
    <>
      <div
        ref={menuRef}
        className="ctx-menu"
        style={{ top: menu.y, left: menu.x }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {menu.items.map((item, i) =>
          isSeparator(item) ? (
            <div key={i} className="ctx-sep" />
          ) : (
            <button
              key={i}
              className="ctx-item"
              onClick={(e) => { e.stopPropagation(); item.action(); setMenu(null); }}
            >
              {item.label}
            </button>
          )
        )}
      </div>
      <style>{`
        .ctx-menu {
          position: fixed; z-index: 9999;
          background: var(--body-card-bg);
          border: 1px solid var(--body-card-border);
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12);
          padding: 4px;
          min-width: 180px;
          max-width: 260px;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .ctx-item {
          display: block; width: 100%;
          text-align: left;
          padding: 7px 12px;
          background: transparent;
          border: none;
          border-radius: 5px;
          color: var(--body-text);
          font-size: 13px;
          font-family: var(--font-body);
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ctx-item:hover { background: var(--accent); color: #fff; }
        .ctx-sep { height: 1px; background: var(--body-card-border); margin: 3px 8px; }
      `}</style>
    </>
  );
}
