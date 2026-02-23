interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function LockIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M25.905 13.71h1.52v15.24h-1.52Z" />
      <path fill="currentColor" d="M24.375 28.95h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M7.615 30.48h16.76V32H7.615Z" />
      <path fill="currentColor" d="M21.335 1.52h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="m18.285 19.81 -1.52 0 0 -1.52 1.52 0 0 -1.53 -4.57 0 0 1.53 -1.53 0 0 3.04 1.53 0 0 1.53 1.52 0 0 4.57 1.53 0 0 -4.57 1.52 0 0 -1.53 1.52 0 0 -3.04 -1.52 0 0 1.52z" />
      <path fill="currentColor" d="M10.665 0h10.67v1.52h-10.67Z" />
      <path fill="currentColor" d="M9.145 1.52h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="m25.905 13.71 0 -1.52 -1.53 0 0 -9.14 -1.52 0 0 9.14 -13.71 0 0 -9.14 -1.53 0 0 9.14 -1.52 0 0 1.52 19.81 0z" />
      <path fill="currentColor" d="M6.095 28.95h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M4.575 13.71h1.52v15.24h-1.52Z" />
    </svg>
  );
}
