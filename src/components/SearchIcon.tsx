interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function SearchIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="m24.38 19.81 -1.53 0 0 3.05 -3.04 0 0 1.52 -3.05 0 0 1.52 4.57 0 0 1.53 1.52 0 0 1.52 1.53 0 0 1.53 1.52 0 0 1.52 1.53 0 0 -1.52 1.52 0 0 -1.53 1.52 0 0 -1.52 1.53 0 0 -1.53 -1.53 0 0 -1.52 -1.52 0 0 -1.52 -1.52 0 0 -1.53 -1.53 0 0 -4.57 -1.52 0 0 3.05z" />
      <path fill="currentColor" d="M25.9 10.67h1.53v6.09H25.9Z" />
      <path fill="currentColor" d="M24.38 7.62h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M22.85 4.57h1.53v3.05h-1.53Z" />
      <path fill="currentColor" d="M21.33 12.19h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M19.81 9.14h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M19.81 3.05h3.04v1.52h-3.04Z" />
      <path fill="currentColor" d="M16.76 7.62h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M16.76 1.52h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="M13.71 6.1h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M10.66 25.9h6.1v1.53h-6.1Z" />
      <path fill="currentColor" d="M10.66 0h6.1v1.52h-6.1Z" />
      <path fill="currentColor" d="M7.62 24.38h3.04v1.52H7.62Z" />
      <path fill="currentColor" d="M7.62 1.52h3.04v1.53H7.62Z" />
      <path fill="currentColor" d="M4.57 22.86h3.05v1.52H4.57Z" />
      <path fill="currentColor" d="M4.57 3.05h3.05v1.52H4.57Z" />
      <path fill="currentColor" d="M3.05 19.81h1.52v3.05H3.05Z" />
      <path fill="currentColor" d="M3.05 4.57h1.52v3.05H3.05Z" />
      <path fill="currentColor" d="M1.52 16.76h1.53v3.05H1.52Z" />
      <path fill="currentColor" d="M1.52 7.62h1.53v3.05H1.52Z" />
      <path fill="currentColor" d="M0 10.67h1.52v6.09H0Z" />
    </svg>
  );
}
