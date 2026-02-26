interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function StarPixelIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M30.48 12.19H32v1.52h-1.52Z" />
      <path fill="currentColor" d="M28.95 13.71h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M27.43 27.43h1.52v3.04h-1.52Z" />
      <path fill="currentColor" d="M25.9 24.38h1.53v3.05H25.9Z" />
      <path fill="currentColor" d="M25.9 15.23h3.05v1.53H25.9Z" />
      <path fill="currentColor" d="M24.38 30.47h3.05V32h-3.05Z" />
      <path fill="currentColor" d="M24.38 21.33h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M24.38 16.76h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M22.86 28.95h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M22.86 18.28h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M19.81 27.43h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M21.33 10.66h9.15v1.53h-9.15Z" />
      <path fill="currentColor" d="M19.81 7.62h1.52v3.04h-1.52Z" />
      <path fill="currentColor" d="M18.29 25.9h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M18.29 16.76h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M18.29 4.57h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M16.76 24.38h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M16.76 13.71h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M16.76 1.52h1.53v3.05h-1.53Z" />
      <path fill="currentColor" d="M15.24 22.85h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M13.71 18.28h4.58v1.53h-4.58Z" />
      <path fill="currentColor" d="M15.24 0h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M13.71 24.38h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M13.71 13.71h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M13.71 1.52h1.53v3.05h-1.53Z" />
      <path fill="currentColor" d="M12.19 25.9h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M12.19 16.76h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M12.19 4.57h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M10.67 7.62h1.52v3.04h-1.52Z" />
      <path fill="currentColor" d="M9.14 27.43h3.05v1.52H9.14Z" />
      <path fill="currentColor" d="M7.62 28.95h1.52v1.52H7.62Z" />
      <path fill="currentColor" d="M7.62 18.28h1.52v3.05H7.62Z" />
      <path fill="currentColor" d="M6.1 21.33h1.52v3.05H6.1Z" />
      <path fill="currentColor" d="M6.1 16.76h1.52v1.52H6.1Z" />
      <path fill="currentColor" d="M4.57 30.47h3.05V32H4.57Z" />
      <path fill="currentColor" d="M4.57 24.38H6.1v3.05H4.57Z" />
      <path fill="currentColor" d="M3.05 15.23H6.1v1.53H3.05Z" />
      <path fill="currentColor" d="M3.05 27.43h1.52v3.04H3.05Z" />
      <path fill="currentColor" d="M1.52 10.66h9.15v1.53H1.52Z" />
      <path fill="currentColor" d="M1.52 13.71h1.53v1.52H1.52Z" />
      <path fill="currentColor" d="M0 12.19h1.52v1.52H0Z" />
    </svg>
  );
}
