interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function CoffeeCupIcon({ size = 32, className, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M0,0H14V4H12V6h2V8h2V6H14V4h2V0h6V2H20V6h2V8H20v2h2v2H8V10H4v8H6v4H8v2H2v2H0Z" fill="currentColor"/>
      <path d="M2,0h8V10H8V8H4v2H0V8H2V6H0V2H2Z" transform="translate(22)" fill="currentColor"/>
      <path d="M0,0H4V6H2V8H0Z" transform="translate(26 10)" fill="currentColor"/>
      <path d="M0,0H2V2H16V0h2V6H16V8H14v2H12v2H6V10H4V8H2V4H0Z" transform="translate(6 14)" fill="currentColor"/>
      <path d="M8,0h2V10H8V8H0V6H2V4H6V2H8Z" transform="translate(22 16)" fill="currentColor"/>
      <path d="M0,0H6V2H20V0h8V2H26V4H2V2H0Z" transform="translate(2 26)" fill="currentColor"/>
      <path d="M0,0H4V2H0Z" transform="translate(0 30)" fill="currentColor"/>
      <path d="M0,0H4V2H0Z" transform="translate(28 30)" fill="currentColor"/>
    </svg>
  );
}
