import AboutIcon from '../components/AboutIcon';
import CoffeeCupIcon from '../components/CoffeeCupIcon';

export default function About() {
  return (
    <div className="legal-page about-page">
      <h1 className="section-title"><AboutIcon size={22} /> About covers.cafe</h1>

      <div className="legal-body">
        <p className="about-lede">
          We know this space is watched.<br />
          By labels. By copyright offices. By the fans.
        </p>

        <p>
          We know album art matters; it matters to artists, to labels, and to the fans who live with it.
          It's not just a symbolic image. It's something people sit with. Something that becomes heritage.
          Lineage. Something they pass down like heirlooms. Something they obsess over, reinterpret,
          rearrange, and carry across devices and years.
        </p>

        <p>
          Album art holds deep connections to the hands of the artists — yes — but also the fans,
          who cherry pick and idealize and scrape at metaphoric varnish on digital art until they see
          it in a clear light.
        </p>

        <p>
          We're not here to replace the official channels. We're here because fans deserve a clean,
          dedicated place built specifically for album cover culture, and not one buried inside platforms
          that were never designed for it.
        </p>

        <p>
          Other systems weren't built for this use case. They struggle with spam, fragmentation,
          tracking-heavy environments, or chaos. We built something focused, moderated, and intentional.
        </p>

        <p>
          We love our users. We built this for people who care about their libraries, who care about
          presentation, who care about the art as much as the audio.
        </p>

        <p>
          There will always be other places to run to.<br />
          We built this one out in the wild.
        </p>

        <p>So drop your bags at the front door, and get comfortable.</p>

        <div className="about-sign"><CoffeeCupIcon size={56} /></div>
      </div>

      <div className="about-meta">
        <div className="about-meta-row"><span className="about-meta-key">Version</span><span className="about-meta-val">Mocha 1.0.0 Stable</span></div>
        <div className="about-meta-row"><span className="about-meta-key">Stack</span><span className="about-meta-val">Astro + React + Supabase</span></div>
        <div className="about-meta-row">
          <span className="about-meta-key">Support</span>
          <a
            href="https://buymeacoffee.com/covers.cafe"
            target="_blank"
            rel="noopener noreferrer"
            className="about-meta-link"
          >
            buymeacoffee.com/covers.cafe
          </a>
        </div>
      </div>

      <style>{`
        .about-page { max-width: 680px; }
        .legal-body { display: flex; flex-direction: column; gap: 0; }
        .legal-body p { font-size: 20px; color: var(--body-text); line-height: 1.75; margin: 0 0 14px; }
        .about-lede {
          font-size: 19px !important;
          font-weight: bold;
          line-height: 1.6 !important;
          margin-bottom: 20px !important;
        }
        .about-sign { margin-top: 12px; }
        .about-meta {
          margin-top: 32px;
          padding: 16px 20px;
          border: 1px solid var(--body-border);
          border-radius: 8px;
          background: var(--body-card-bg);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .about-meta-row { display: flex; align-items: center; gap: 12px; font-size: 19px; }
        .about-meta-key { font-weight: bold; color: var(--body-text-muted); min-width: 70px; }
        .about-meta-val { color: var(--body-text); }
        .about-meta-link { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
        .about-meta-link:hover { color: var(--accent-light); }
      `}</style>
    </div>
  );
}
