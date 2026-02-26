import { useEffect, useState } from 'react';
import AboutIcon from '../components/AboutIcon';
import CoffeeCupIcon from '../components/CoffeeCupIcon';

const FALLBACK_BODY = `We know this space is watched.
By labels. By copyright offices. By the fans.

We know album art matters; it matters to artists, to labels, and to the fans who live with it. It's not just a symbolic image. It's something people sit with. Something that becomes heritage. Lineage. Something they pass down like heirlooms. Something they obsess over, reinterpret, rearrange, and carry across devices and years.

Album art holds deep connections to the hands of the artists  -  yes  -  but also the fans, who cherry pick and idealize and scrape at metaphoric varnish on digital art until they see it in a clear light.

We're not here to replace the official channels. We're here because fans deserve a clean, dedicated place built specifically for album cover culture, and not one buried inside platforms that were never designed for it.

Other systems weren't built for this use case. They struggle with spam, fragmentation, tracking-heavy environments, or chaos. We built something focused, moderated, and intentional.

We love our users. We built this for people who care about their libraries, who care about presentation, who care about the art as much as the audio.

There will always be other places to run to.
We built this one out in the wild.

So drop your bags at the front door, and get comfortable.`;

export default function About() {
  const [body, setBody] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/cms/site-content?key=about_body')
      .then((r) => r.json())
      .then((data: { value: string | null }) => {
        if (data.value) setBody(data.value);
      })
      .catch(() => { /* fall through to fallback */ });
  }, []);

  const displayBody = body ?? FALLBACK_BODY;

  return (
    <div className="legal-page about-page">
      <h1 className="section-title"><AboutIcon size={22} /> About covers.cafe</h1>

      <div className="legal-body">
        {displayBody.split('\n').map((line, i) =>
          line.trim() === ''
            ? <br key={i} />
            : i === 0
              ? <p key={i} className="about-lede">{line}</p>
              : <p key={i}>{line}</p>
        )}

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
    </div>
  );
}
