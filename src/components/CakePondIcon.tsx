interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function CakePondIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="m30.47 16.76 -1.52 0 0 1.53 1.52 0 0 4.57 -28.95 0 0 -4.57 1.52 0 0 -1.53 -1.52 0 0 -4.57 -1.52 0 0 16.76 1.52 0 0 -3.04 28.95 0 0 3.04 1.53 0 0 -16.76 -1.53 0 0 4.57z" />
      <path fill="currentColor" d="M28.95 28.95h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M28.95 10.67h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M27.42 13.71h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M3.04 30.48h25.91V32H3.04Z" />
      <path fill="currentColor" d="M24.38 18.29h4.57v1.52h-4.57Z" />
      <path fill="currentColor" d="M22.85 16.76h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M21.33 0h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M19.81 12.19h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M16.76 18.29h6.09v1.52h-6.09Z" />
      <path fill="currentColor" d="M15.23 16.76h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M15.23 0h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M10.66 12.19h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M9.14 18.29h6.09v1.52H9.14Z" />
      <path fill="currentColor" d="M9.14 0h1.52v1.52H9.14Z" />
      <path fill="currentColor" d="M7.61 16.76h1.53v1.53H7.61Z" />
      <path fill="currentColor" d="m28.95 10.67 0 -1.53 -6.1 0 0 -6.09 -1.52 0 0 6.09 -4.57 0 0 -6.09 -1.53 0 0 6.09 -4.57 0 0 -6.09 -1.52 0 0 6.09 -6.1 0 0 1.53 25.91 0z" />
      <path fill="currentColor" d="M3.04 18.29h4.57v1.52H3.04Z" />
      <path fill="currentColor" d="M3.04 13.71h1.53v1.53H3.04Z" />
      <path fill="currentColor" d="M1.52 28.95h1.52v1.53H1.52Z" />
      <path fill="currentColor" d="M1.52 10.67h1.52v1.52H1.52Z" />
    </svg>
  );
}
