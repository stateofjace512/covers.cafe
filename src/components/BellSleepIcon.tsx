interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function BellSleepIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M30.48 3.05H32v1.52h-1.52Z" />
      <path fill="currentColor" d="M28.95 4.57h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M24.38 1.52h6.1v1.53h-6.1Z" />
      <path fill="currentColor" d="M27.43 24.38h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M27.43 6.09h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M25.91 27.43h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M25.91 22.86h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M25.91 10.67H32v1.52h-6.09Z" />
      <path fill="currentColor" d="M25.91 7.62h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M24.38 15.24h1.53v7.62h-1.53Z" />
      <path fill="currentColor" d="M24.38 9.14h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M22.86 28.95h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="M22.86 25.9h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M22.86 12.19h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="m12.19 27.43 1.53 0 0 1.52 4.57 0 0 -1.52 1.52 0 0 -1.53 3.05 0 0 -1.52 -13.71 0 0 1.52 3.04 0 0 1.53z" />
      <path fill="currentColor" d="M21.34 10.67h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M9.15 30.48h13.71V32H9.15Z" />
      <path fill="currentColor" d="M18.29 9.14h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="M13.72 7.62h4.57v1.52h-4.57Z" />
      <path fill="currentColor" d="M10.67 9.14h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="M9.15 10.67h1.52v1.52H9.15Z" />
      <path fill="currentColor" d="M9.15 1.52h1.52v1.53H9.15Z" />
      <path fill="currentColor" d="M6.1 28.95h3.05v1.53H6.1Z" />
      <path fill="currentColor" d="M7.62 25.9h1.53v1.53H7.62Z" />
      <path fill="currentColor" d="M7.62 12.19h1.53v3.05H7.62Z" />
      <path fill="currentColor" d="M7.62 6.09h3.05v1.53H7.62Z" />
      <path fill="currentColor" d="M7.62 3.05h1.53v1.52H7.62Z" />
      <path fill="currentColor" d="M6.1 0h3.05v1.52H6.1Z" />
      <path fill="currentColor" d="M6.1 15.24h1.52v7.62H6.1Z" />
      <path fill="currentColor" d="M6.1 4.57h1.52v1.52H6.1Z" />
      <path fill="currentColor" d="M4.57 27.43H6.1v1.52H4.57Z" />
      <path fill="currentColor" d="M4.57 22.86H6.1v1.52H4.57Z" />
      <path fill="currentColor" d="M3.05 24.38h1.52v3.05H3.05Z" />
      <path fill="currentColor" d="M3.05 12.19h1.52v1.52H3.05Z" />
      <path fill="currentColor" d="M1.53 16.76h3.04v1.52H1.53Z" />
      <path fill="currentColor" d="M1.53 13.71h1.52v1.53H1.53Z" />
      <path fill="currentColor" d="M0 10.67h3.05v1.52H0Z" />
      <path fill="currentColor" d="M0 15.24h1.53v1.52H0Z" />
    </svg>
  );
}
