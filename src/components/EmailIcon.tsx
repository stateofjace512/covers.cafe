interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function EmailIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="m30.48 12.19 0 -1.52 -1.53 0 0 -1.53 -1.52 0 0 -3.04 -1.52 0 0 12.19 1.52 0 0 -1.53 1.52 0 0 -1.52 1.53 0 0 13.71 1.52 0 0 -16.76 -1.52 0z" />
      <path fill="currentColor" d="M28.95 28.95h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M3.05 30.48h25.9V32H3.05Z" />
      <path fill="currentColor" d="M24.38 18.29h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M22.86 25.91h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M22.86 19.81h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M21.33 24.38h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M21.33 21.33h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M21.33 10.67h1.53v4.57h-1.53Z" />
      <path fill="currentColor" d="M19.81 9.14h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M10.67 22.86h10.66v1.52H10.67Z" />
      <path fill="currentColor" d="M18.29 15.24h3.04v1.52h-3.04Z" />
      <path fill="currentColor" d="m18.29 10.67 -4.57 0 0 1.52 3.04 0 0 3.05 1.53 0 0 -4.57z" />
      <path fill="currentColor" d="M13.72 15.24h3.04v1.52h-3.04Z" />
      <path fill="currentColor" d="M12.19 7.62h7.62v1.52h-7.62Z" />
      <path fill="currentColor" d="M12.19 18.29h7.62v1.52h-7.62Z" />
      <path fill="currentColor" d="M12.19 12.19h1.53v3.05h-1.53Z" />
      <path fill="currentColor" d="M10.67 16.76h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M10.67 9.14h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M9.14 24.38h1.53v1.53H9.14Z" />
      <path fill="currentColor" d="M9.14 21.33h1.53v1.53H9.14Z" />
      <path fill="currentColor" d="M9.14 10.67h1.53v6.09H9.14Z" />
      <path fill="currentColor" d="M7.62 25.91h1.52v1.52H7.62Z" />
      <path fill="currentColor" d="M7.62 19.81h1.52v1.52H7.62Z" />
      <path fill="currentColor" d="m25.91 6.1 0 -1.53 -3.05 0 0 -1.52 -1.53 0 0 -1.53 -1.52 0 0 -1.52 -7.62 0 0 1.52 -1.52 0 0 1.53 -1.53 0 0 1.52 -3.04 0 0 1.53 19.81 0z" />
      <path fill="currentColor" d="M6.1 18.29h1.52v1.52H6.1Z" />
      <path fill="currentColor" d="M1.52 28.95h1.53v1.53H1.52Z" />
      <path fill="currentColor" d="m1.52 15.24 1.53 0 0 1.52 1.52 0 0 1.53 1.53 0 0 -12.19 -1.53 0 0 3.04 -1.52 0 0 1.53 -1.53 0 0 1.52 -1.52 0 0 16.76 1.52 0 0 -13.71z" />
    </svg>
  );
}
