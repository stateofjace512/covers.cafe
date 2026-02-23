interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// FavoritesIcon — pixel-art icon, fill inherits currentColor for theme support.
// Original viewBox: 120×120.
export default function FavoritesIcon({ size = 18, className, style }: Props) {
  const w = Math.round(size * (120 / 120));
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={w}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path fill="currentColor" d="M57 26h7v1h-7zm0 1h7v1h-7zm0 1h7v1h-7zm0 1h7v1h-7zm0 1h7v1h-7zm0 1h7v1h-7zm0 1h7v1h-7zm-4 1h15v1H53zm0 1h15v1H53zm0 1h15v1H53zm0 1h15v1H53zm0 1h15v1H53zm0 1h15v1H53zm0 1h15v1H53zm0 1h15v1H53zm-4 1h23v1H49zm0 1h23v1H49zm0 1h23v1H49zm0 1h23v1H49zm-22 1h68v1H27zm0 1h68v1H27zm0 1h68v1H27zm0 1h68v1H27zm7 1h53v1H34zm0 1h53v1H34zm0 1h53v1H34zm4 1h45v1H38zm0 1h45v1H38zm0 1h45v1H38zm0 1h45v1H38z"/>
      <path fill="currentColor" d="M42 55h37v3H42z"/>
      <path fill="currentColor" d="M42 57h37v1H42zm0 1h37v1H42zm0 1h37v1H42zm4 1h30v1H46zm0 1h30v1H46zm0 1h30v1H46zm0 1h30v1H46zm0 1h30v1H46zm0 1h30v1H46zm0 1h30v1H46zm0 1h30v1H46zm-4 1h37v1H42zm0 1h37v1H42zm0 1h37v1H42zm0 1h15v1H42zm22 0h15v1H64zm-22 1h15v1H42zm22 0h15v1H64zm-22 1h15v1H42zm22 0h15v1H64zm-22 1h15v1H42zm22 0h15v1H64zm-22 1h11v1H42zm26 0h11v1H68zm-26 1h11v1H42zm26 0h11v1H68zm-26 1h11v1H42zm26 0h11v1H68zm-26 1h11v1H42zm26 0h11v1H68zm-30 1h7v1h-7zm38 0h7v1h-7zm-38 1h7v1h-7zm38 0h7v1h-7zm-38 1h7v1h-7zm38 0h7v1h-7zm-38 1h7v1h-7zm38 0h7v1h-7zm-38 1h4v1h-4zm42 0h3v1h-3zm-42 1h4v1h-4zm42 0h3v1h-3zm-42 1h4v1h-4zm42 0h3v1h-3zm-42 1h4v1h-4zm42 0h3v1h-3z"/>
    </svg>
  );
}
