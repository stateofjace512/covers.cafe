interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function StopSignPixelIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M30.48 7.62H32v16.76h-1.52Z" />
      <path fill="currentColor" d="M28.95 24.38h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M28.95 6.09h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M27.43 25.9h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M27.43 4.57h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M25.91 27.43h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M25.91 3.05h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M24.38 28.95h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M24.38 1.52h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M22.86 10.67h1.52v13.71h-1.52Z" />
      <path fill="currentColor" d="M7.62 30.48h16.76V32H7.62Z" />
      <path fill="currentColor" d="M21.34 24.38h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="m19.81 16.76 1.53 0 0 -6.09 1.52 0 0 -1.53 -1.52 0 0 -1.52 -1.53 0 0 9.14z" />
      <path fill="currentColor" d="M12.19 25.9h9.15v1.53h-9.15Z" />
      <path fill="currentColor" d="M18.29 21.33h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M18.29 18.28h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="m16.76 16.76 1.53 0 0 -9.14 1.52 0 0 -1.53 -3.05 0 0 10.67z" />
      <path fill="currentColor" d="M15.24 22.86h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M13.72 21.33h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M13.72 18.28h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="m13.72 16.76 1.52 0 0 -10.67 1.52 0 0 -1.52 -3.04 0 0 1.52 -1.53 0 0 1.53 1.53 0 0 9.14z" />
      <path fill="currentColor" d="M10.67 24.38h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M9.15 21.33h1.52v3.05H9.15Z" />
      <path fill="currentColor" d="m10.67 16.76 0 1.52 1.52 0 0 -10.66 -1.52 0 0 7.62 -1.52 0 0 1.52 1.52 0z" />
      <path fill="currentColor" d="M7.62 0h16.76v1.52H7.62Z" />
      <path fill="currentColor" d="M7.62 19.81h1.53v1.52H7.62Z" />
      <path fill="currentColor" d="M6.1 13.71h3.05v1.53H6.1Z" />
      <path fill="currentColor" d="M6.1 28.95h1.52v1.53H6.1Z" />
      <path fill="currentColor" d="M6.1 18.28h1.52v1.53H6.1Z" />
      <path fill="currentColor" d="M6.1 1.52h1.52v1.53H6.1Z" />
      <path fill="currentColor" d="M4.57 27.43H6.1v1.52H4.57Z" />
      <path fill="currentColor" d="M4.57 15.24H6.1v3.04H4.57Z" />
      <path fill="currentColor" d="M4.57 3.05H6.1v1.52H4.57Z" />
      <path fill="currentColor" d="M3.05 25.9h1.52v1.53H3.05Z" />
      <path fill="currentColor" d="M3.05 4.57h1.52v1.52H3.05Z" />
      <path fill="currentColor" d="M1.53 24.38h1.52v1.52H1.53Z" />
      <path fill="currentColor" d="M1.53 6.09h1.52v1.53H1.53Z" />
      <path fill="currentColor" d="M0 7.62h1.53v16.76H0Z" />
    </svg>
  );
}
