interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function SunIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M28.95 9.14H32v1.53h-3.05Z" />
      <path fill="currentColor" d="M28.95 21.33H32v1.53h-3.05Z" />
      <path fill="currentColor" d="M28.95 15.24H32v1.52h-3.05Z" />
      <path fill="currentColor" d="M27.43 27.43h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M27.43 3.05h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M25.91 25.9h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M25.91 12.19h1.52v7.62h-1.52Z" />
      <path fill="currentColor" d="M25.91 4.57h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M24.38 19.81h1.53v3.05h-1.53Z" />
      <path fill="currentColor" d="M24.38 9.14h1.53v3.05h-1.53Z" />
      <path fill="currentColor" d="M22.86 7.62h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M21.34 28.95h1.52V32h-1.52Z" />
      <path fill="currentColor" d="m21.34 24.38 -1.53 0 0 1.52 3.05 0 0 -1.52 1.52 0 0 -1.52 -3.04 0 0 1.52z" />
      <path fill="currentColor" d="M21.34 0h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M19.81 6.09h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="M12.19 25.9h7.62v1.53h-7.62Z" />
      <path fill="currentColor" d="M15.24 28.95h1.52V32h-1.52Z" />
      <path fill="currentColor" d="M15.24 0h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M12.19 4.57h7.62v1.52h-7.62Z" />
      <path fill="currentColor" d="m10.67 24.38 0 -1.52 -3.05 0 0 1.52 1.53 0 0 1.52 3.04 0 0 -1.52 -1.52 0z" />
      <path fill="currentColor" d="M9.15 6.09h3.04v1.53H9.15Z" />
      <path fill="currentColor" d="M9.15 28.95h1.52V32H9.15Z" />
      <path fill="currentColor" d="M9.15 0h1.52v3.05H9.15Z" />
      <path fill="currentColor" d="M7.62 7.62h1.53v1.52H7.62Z" />
      <path fill="currentColor" d="M6.1 19.81h1.52v3.05H6.1Z" />
      <path fill="currentColor" d="M6.1 9.14h1.52v3.05H6.1Z" />
      <path fill="currentColor" d="M4.57 25.9H6.1v1.53H4.57Z" />
      <path fill="currentColor" d="M4.57 12.19H6.1v7.62H4.57Z" />
      <path fill="currentColor" d="M4.57 4.57H6.1v1.52H4.57Z" />
      <path fill="currentColor" d="M3.05 27.43h1.52v1.52H3.05Z" />
      <path fill="currentColor" d="M3.05 3.05h1.52v1.52H3.05Z" />
      <path fill="currentColor" d="M0 21.33h3.05v1.53H0Z" />
      <path fill="currentColor" d="M0 15.24h3.05v1.52H0Z" />
      <path fill="currentColor" d="M0 9.14h3.05v1.53H0Z" />
    </svg>
  );
}
