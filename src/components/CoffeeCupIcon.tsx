interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** Pixel-art coffee cup icon. Dark (#1a1a1a) body with white (#fff) highlights.
 *  In dark mode a CSS invert keeps it legible on dark backgrounds. */
export default function CoffeeCupIcon({ size = 32, className = '', style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={`coffee-cup-icon${className ? ' ' + className : ''}`}
      style={style}
      aria-hidden="true"
    >
      <path d="M0,0H14V4H12V6h2V8h2V6H14V4h2V0h6V2H20V6h2V8H20v2h2v2H8V10H4v8H6v4H8v2H2v2H0Z" fill="#1a1a1a"/>
      <path d="M0,0H2V4H0Z" transform="translate(14)" fill="#ffffff"/>
      <path d="M0,0H2V2H0Z" transform="translate(22)" fill="#ffffff"/>
      <path d="M2,0h8V10H8V8H4v2H0V8H2V6H0V2H2Z" transform="translate(22)" fill="#1a1a1a"/>
      <path d="M0,0H2V4H0Z" transform="translate(6 2)" fill="#ffffff"/>
      <path d="M0,0H2V4H0Z" transform="translate(20 2)" fill="#ffffff"/>
      <path d="M0,0H2V2H0Z" transform="translate(12 4)" fill="#ffffff"/>
      <path d="M0,0H2V2H0Z" transform="translate(8 6)" fill="#ffffff"/>
      <path d="M0,0H2V2H0Z" transform="translate(14 6)" fill="#ffffff"/>
      <path d="M0,0H2V2H0Z" transform="translate(22 6)" fill="#ffffff"/>
      <path d="M0,0H2V2H0Z" transform="translate(20 8)" fill="#ffffff"/>
      <path d="M0,0H4V2H0Z" transform="translate(26 8)" fill="#ffffff"/>
      <path d="M0,0H4V2H18V0h4V8h2v2H20V4H18V6H4V4H2V8H0Z" transform="translate(4 10)" fill="#ffffff"/>
      <path d="M0,0H4V6H2V8H0Z" transform="translate(26 10)" fill="#1a1a1a"/>
      <path d="M0,0H2V6H0Z" transform="translate(30 10)" fill="#ffffff"/>
      <path d="M0,0H2V2H16V0h2V6H16V8H14v2H12v2H6V10H4V8H2V4H0Z" transform="translate(6 14)" fill="#1a1a1a"/>
      <path d="M0,0H2V2H0Z" transform="translate(28 16)" fill="#ffffff"/>
      <path d="M8,0h2V10H8V8H0V6H2V4H6V2H8Z" transform="translate(22 16)" fill="#1a1a1a"/>
      <path d="M0,0H2V4H0Z" transform="translate(6 18)" fill="#ffffff"/>
      <path d="M0,0H2V2H0Z" transform="translate(22 20)" fill="#ffffff"/>
      <path d="M6,0H8V2h2V4h6V2h2V0h2V2h8V4H20V6H6V4H0V2H6Z" transform="translate(2 22)" fill="#ffffff"/>
      <path d="M0,0H2V2H4V4H0Z" transform="translate(0 26)" fill="#ffffff"/>
      <path d="M0,0H6V2H20V0h8V2H26V4H2V2H0Z" transform="translate(2 26)" fill="#1a1a1a"/>
      <path d="M2,0H4V4H0V2H2Z" transform="translate(28 26)" fill="#ffffff"/>
      <path d="M0,0H4V2H0Z" transform="translate(0 30)" fill="#1a1a1a"/>
      <path d="M0,0H24V2H0Z" transform="translate(4 30)" fill="#ffffff"/>
      <path d="M0,0H4V2H0Z" transform="translate(28 30)" fill="#1a1a1a"/>

      <style>{`
        [data-theme="dark"] .coffee-cup-icon { filter: invert(1); }
      `}</style>
    </svg>
  );
}
