interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function UserSingleAimIcon({ size = 18, className, style }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      {/* Person figure — centered */}
      {/* Head */}
      <path fill="currentColor" d="M12 6h8v6h-8Z" />
      {/* Body */}
      <path fill="currentColor" d="M10 12h12v8h-12Z" />
      {/* Left leg */}
      <path fill="currentColor" d="M10 20h4v6h-4Z" />
      {/* Right leg */}
      <path fill="currentColor" d="M18 20h4v6h-4Z" />

      {/* Target / aim brackets (4-corner viewfinder) */}
      {/* Top-left bracket */}
      <path fill="currentColor" d="M2 2h8v2H2Z" />
      <path fill="currentColor" d="M2 2h2v8H2Z" />
      {/* Top-right bracket */}
      <path fill="currentColor" d="M22 2h8v2h-8Z" />
      <path fill="currentColor" d="M28 2h2v8h-2Z" />
      {/* Bottom-left bracket */}
      <path fill="currentColor" d="M2 28h8v2H2Z" />
      <path fill="currentColor" d="M2 22h2v8H2Z" />
      {/* Bottom-right bracket */}
      <path fill="currentColor" d="M22 28h8v2h-8Z" />
      <path fill="currentColor" d="M28 22h2v8h-2Z" />
    </svg>
  );
}
