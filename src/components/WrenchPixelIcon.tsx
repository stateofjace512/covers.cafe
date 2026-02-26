interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function WrenchPixelIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="m30.48 25.9 -1.53 0 0 1.53 3.05 0 0 -6.1 -1.52 0 0 4.57z" />
      <path fill="currentColor" d="M28.95 19.81h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M27.43 24.38h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="m22.86 22.86 0 4.57 1.52 0 0 1.52 1.53 0 0 1.53 -4.57 0 0 1.52 6.09 0 0 -4.57 -1.52 0 0 -3.05 1.52 0 0 -1.52 -4.57 0z" />
      <path fill="currentColor" d="M19.81 28.95h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M19.81 19.81h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M18.29 22.86h1.52v6.09h-1.52Z" />
      <path fill="currentColor" d="M18.29 18.28h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M16.76 21.33h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M16.76 16.76h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M15.24 19.81h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M15.24 15.24h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M13.72 18.28h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M13.72 13.71h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M12.19 16.76h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M12.19 12.19h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M10.67 15.24h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M10.67 10.67h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M9.15 13.71h1.52v1.53H9.15Z" />
      <path fill="currentColor" d="M3.05 12.19h6.1v1.52h-6.1Z" />
      <path fill="currentColor" d="M6.1 3.05h1.52v1.52H6.1Z" />
      <path fill="currentColor" d="m10.67 1.52 0 1.53 1.52 0 0 6.09 1.53 0 0 1.53 1.52 0 0 1.52 1.52 0 0 1.52 1.53 0 0 1.53 1.52 0 0 1.52 1.53 0 0 1.52 1.52 0 0 1.53 6.09 0 0 -1.53 -4.57 0 0 -1.52 -1.52 0 0 -1.52 -1.52 0 0 -1.53 -1.53 0 0 -1.52 -1.52 0 0 -1.52 -1.53 0 0 -1.53 -1.52 0 0 -6.09 -1.52 0 0 -1.53 -1.53 0 0 -1.52 -7.62 0 0 3.05 1.53 0 0 -1.53 4.57 0z" />
      <path fill="currentColor" d="M1.53 10.67h1.52v1.52H1.53Z" />
      <path fill="currentColor" d="m1.53 6.09 1.52 0 0 1.53 1.52 0 0 1.52 4.58 0 0 -4.57 -1.53 0 0 3.05 -1.52 0 0 -1.53 -1.53 0 0 -1.52 -4.57 0 0 6.1 1.53 0 0 -4.58z" />
    </svg>
  );
}
