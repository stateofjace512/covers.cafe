interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function AlertTriangleIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M30.48 27.43H32v3.05h-1.52Z" />
      <path fill="currentColor" d="M28.95 24.38h1.53v3.05h-1.53Z" />
      <path fill="currentColor" d="M1.52 30.48h28.96V32H1.52Z" />
      <path fill="currentColor" d="M27.43 21.33h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M25.9 18.29h1.53v3.04H25.9Z" />
      <path fill="currentColor" d="M24.38 15.24h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M22.86 12.19h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M21.33 9.14h1.53v3.05h-1.53Z" />
      <path fill="currentColor" d="M19.81 6.09h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M18.29 3.05h1.52v3.04h-1.52Z" />
      <path fill="currentColor" d="m18.29 21.33 -4.58 0 0 1.53 -1.52 0 0 4.57 1.52 0 0 1.52 4.58 0 0 -1.52 1.52 0 0 -4.57 -1.52 0 0 -1.53z" />
      <path fill="currentColor" d="M18.29 9.14h-4.58v1.53h-1.52v6.09h1.52v3.05h4.58v-3.05h1.52v-6.09h-1.52Zm0 6.1h-1.53v-3.05h-1.52v-1.52h1.52v1.52h1.53Z" />
      <path fill="currentColor" d="M16.76 1.52h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M15.24 0h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M13.71 1.52h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M12.19 3.05h1.52v3.04h-1.52Z" />
      <path fill="currentColor" d="M10.67 6.09h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M9.14 9.14h1.53v3.05H9.14Z" />
      <path fill="currentColor" d="M7.62 12.19h1.52v3.05H7.62Z" />
      <path fill="currentColor" d="M6.09 15.24h1.53v3.05H6.09Z" />
      <path fill="currentColor" d="M4.57 18.29h1.52v3.04H4.57Z" />
      <path fill="currentColor" d="M3.05 21.33h1.52v3.05H3.05Z" />
      <path fill="currentColor" d="M1.52 24.38h1.53v3.05H1.52Z" />
      <path fill="currentColor" d="M0 27.43h1.52v3.05H0Z" />
    </svg>
  );
}
