interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function MonitorIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M30.47 7.62H32v19.81h-1.53Z" />
      <path fill="currentColor" d="m1.52 27.43 0 1.52 1.53 0 0 1.53 1.52 0 0 -1.53 22.86 0 0 1.53 1.52 0 0 -1.53 1.52 0 0 -1.52 -28.95 0z" />
      <path fill="currentColor" d="M27.43 16.76h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M27.43 13.71h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M27.43 10.67h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M24.38 19.81v6.09h4.57v-6.09Zm3.05 3.05H25.9v-1.53h1.53Z" />
      <path fill="currentColor" d="M4.57 30.48h22.86V32H4.57Z" />
      <path fill="currentColor" d="M24.38 16.76h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M24.38 13.71h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M24.38 10.67h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M21.33 10.67h1.52v13.71h-1.52Z" />
      <path fill="currentColor" d="M4.57 24.38h16.76v1.52H4.57Z" />
      <path fill="currentColor" d="M13.71 0h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M12.19 1.52h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M10.66 3.05h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M7.62 3.05h1.52v1.52H7.62Z" />
      <path fill="currentColor" d="M4.57 9.14h16.76v1.53H4.57Z" />
      <path fill="currentColor" d="M6.09 1.52h1.53v1.53H6.09Z" />
      <path fill="currentColor" d="M4.57 0h1.52v1.52H4.57Z" />
      <path fill="currentColor" d="M3.05 10.67h1.52v13.71H3.05Z" />
      <path fill="currentColor" d="m30.47 7.62 0 -1.52 -19.81 0 0 -1.53 -1.52 0 0 1.53 -7.62 0 0 1.52 28.95 0z" />
      <path fill="currentColor" d="M0 7.62h1.52v19.81H0Z" />
    </svg>
  );
}
