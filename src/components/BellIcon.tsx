interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function BellIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M30.47 25.9H32v3.05h-1.53Z" />
      <path fill="currentColor" d="M30.47 3.05H32V6.1h-1.53Z" />
      <path fill="currentColor" d="M28.95 28.95h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M28.95 1.52h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M27.43 25.9h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M27.43 19.81h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M27.43 4.57h1.52V6.1h-1.52Z" />
      <path fill="currentColor" d="M25.9 0h3.05v1.52H25.9Z" />
      <path fill="currentColor" d="M25.9 30.48h3.05V32H25.9Z" />
      <path fill="currentColor" d="M25.9 27.43h1.53v1.52H25.9Z" />
      <path fill="currentColor" d="M25.9 22.86h1.53v1.52H25.9Z" />
      <path fill="currentColor" d="M25.9 18.29h1.53v1.52H25.9Z" />
      <path fill="currentColor" d="M25.9 3.05h1.53v1.52H25.9Z" />
      <path fill="currentColor" d="M22.85 24.38h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M24.38 10.67h1.52v7.62h-1.52Z" />
      <path fill="currentColor" d="M22.85 21.33h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M22.85 7.62h1.53v3.05h-1.53Z" />
      <path fill="currentColor" d="m9.14 21.33 3.05 0 0 1.53 1.52 0 0 1.52 4.57 0 0 -1.52 1.53 0 0 -1.53 3.04 0 0 -1.52 -13.71 0 0 1.52z" />
      <path fill="currentColor" d="M21.33 6.1h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M9.14 25.9h13.71v1.53H9.14Z" />
      <path fill="currentColor" d="M18.28 4.57h3.05V6.1h-3.05Z" />
      <path fill="currentColor" d="M13.71 3.05h4.57v1.52h-4.57Z" />
      <path fill="currentColor" d="M10.66 4.57h3.05V6.1h-3.05Z" />
      <path fill="currentColor" d="M9.14 6.1h1.52v1.52H9.14Z" />
      <path fill="currentColor" d="M6.09 24.38h3.05v1.52H6.09Z" />
      <path fill="currentColor" d="M7.62 21.33h1.52v1.53H7.62Z" />
      <path fill="currentColor" d="M7.62 7.62h1.52v3.05H7.62Z" />
      <path fill="currentColor" d="M6.09 10.67h1.53v7.62H6.09Z" />
      <path fill="currentColor" d="M4.57 27.43h1.52v1.52H4.57Z" />
      <path fill="currentColor" d="M4.57 22.86h1.52v1.52H4.57Z" />
      <path fill="currentColor" d="M4.57 18.29h1.52v1.52H4.57Z" />
      <path fill="currentColor" d="M4.57 3.05h1.52v1.52H4.57Z" />
      <path fill="currentColor" d="M3.05 0h3.04v1.52H3.05Z" />
      <path fill="currentColor" d="M3.05 30.48h3.04V32H3.05Z" />
      <path fill="currentColor" d="M3.05 25.9h1.52v1.53H3.05Z" />
      <path fill="currentColor" d="M3.05 19.81h1.52v3.05H3.05Z" />
      <path fill="currentColor" d="M3.05 4.57h1.52V6.1H3.05Z" />
      <path fill="currentColor" d="M1.52 28.95h1.53v1.53H1.52Z" />
      <path fill="currentColor" d="M1.52 1.52h1.53v1.53H1.52Z" />
      <path fill="currentColor" d="M0 25.9h1.52v3.05H0Z" />
      <path fill="currentColor" d="M0 3.05h1.52V6.1H0Z" />
    </svg>
  );
}
