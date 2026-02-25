interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function UserSleepIcon({ size = 18, className, style }: Props) {
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
      {/* Person figure — left side */}
      {/* Head */}
      <path fill="currentColor" d="M4 10h4v4H4Z" />
      {/* Body */}
      <path fill="currentColor" d="M2 14h8v8H2Z" />
      {/* Left leg */}
      <path fill="currentColor" d="M2 22h2v6H2Z" />
      {/* Right leg */}
      <path fill="currentColor" d="M8 22h2v6H8Z" />

      {/* ZZZ — upper right, ascending */}
      {/* Z1 small */}
      <path fill="currentColor" d="M14 0h4v2h-4Z" />
      <path fill="currentColor" d="M16 2h2v2h-2Z" />
      <path fill="currentColor" d="M14 4h4v2h-4Z" />
      {/* Z2 medium */}
      <path fill="currentColor" d="M16 8h6v2h-6Z" />
      <path fill="currentColor" d="M20 10h2v2h-2Z" />
      <path fill="currentColor" d="M16 12h6v2h-6Z" />
      {/* Z3 large */}
      <path fill="currentColor" d="M18 16h8v2h-8Z" />
      <path fill="currentColor" d="M24 18h2v2h-2Z" />
      <path fill="currentColor" d="M18 20h8v2h-8Z" />
    </svg>
  );
}
