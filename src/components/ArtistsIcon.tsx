interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// ArtistsIcon — pixel-art icon, fill inherits currentColor for theme support.
// Original viewBox: 120×118.
export default function ArtistsIcon({ size = 18, className, style }: Props) {
  const w = Math.round(size * (120 / 118));
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={w}
      height={size}
      viewBox="0 0 120 118"
      aria-hidden="true"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path fill="currentColor" d="M67 7h4v1h-4zm0 1h4v1h-4zm0 1h4v1h-4zm11 1h4v1h-4zm0 1h4v1h-4zm0 1h4v1h-4zm0 1h4v1h-4zm-29 1h3v1h-3zm26 0h3v1h-3zm-26 1h3v1h-3zm26 0h3v1h-3zm-26 1h3v1h-3zm26 0h3v1h-3zm-26 1h3v1h-3zm26 0h3v1h-3zm-38 5h4v1h-4zm8 0h15v1H45zm18 0h4v1h-4zm8 0h4v1h-4zm7 0h4v1h-4zm-41 1h4v1h-4zm8 0h15v1H45zm18 0h4v1h-4zm8 0h4v1h-4zm7 0h4v1h-4zm-41 1h4v1h-4zm8 0h15v1H45zm18 0h4v1h-4zm8 0h4v1h-4zm7 0h4v1h-4zm-41 1h4v1h-4zm8 0h22v1H45zm26 0h4v1h-4zm7 0h4v1h-4zm-41 1h4v1h-4zm8 0h22v1H45zm26 0h4v1h-4zm7 0h4v1h-4zm-41 1h4v1h-4zm8 0h22v1H45zm26 0h4v1h-4zm7 0h4v1h-4zm-41 1h4v1h-4zm8 0h22v1H45zm26 0h4v1h-4zm7 0h4v1h-4zm-41 1h4v1h-4zm8 0h22v1H45zm26 0h4v1h-4zm7 0h4v1h-4zm-41 1h4v1h-4zm8 0h22v1H45zm26 0h4v1h-4zm7 0h4v1h-4zm-41 1h4v1h-4zm8 0h22v1H45zm26 0h4v1h-4zm7 0h4v1h-4zm-41 1h4v1h-4zm8 0h22v1H45zm26 0h4v1h-4zm7 0h4v1h-4zm-41 1h4v1h-4zm8 0h30v1H45zm33 0h4v1h-4zm-41 1h4v1h-4zm8 0h30v1H45zm33 0h4v1h-4zm-41 1h4v1h-4zm8 0h30v1H45zm33 0h4v1h-4zm-41 1h4v1h-4zm8 0h30v1H45zm33 0h4v1h-4zm-41 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 4h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm0 1h45v1H37zm4 1h37v1H41zm0 1h37v1H41zm0 1h37v1H41zm0 1h37v1H41zm11 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm4 1h7v1h-7zm0 1h7v1h-7zm0 1h7v1h-7zm0 1h7v1h-7zm0 1h7v1h-7zm0 1h7v1h-7zm0 1h7v1h-7zm-4 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm0 1h15v1H52zm4 1h7v1h-7zm0 1h7v1h-7zm0 1h7v1h-7z"/>
    </svg>
  );
}
