interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function MusicIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M15.24 9.15H32v1.52H15.24Z" />
      <path fill="currentColor" d="M13.72 27.43H32v1.53H13.72Z" />
      <path fill="currentColor" d="M16.77 22.86H32v1.52H16.77Z" />
      <path fill="currentColor" d="M18.29 18.29H32v1.52H18.29Z" />
      <path fill="currentColor" d="M16.77 13.72H32v1.52H16.77Z" />
      <path fill="currentColor" d="M15.24 16.76h1.53v4.58h-1.53Z" />
      <path fill="currentColor" d="M15.24 1.53h1.53V6.1h-1.53Z" />
      <path fill="currentColor" d="M13.72 21.34h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M13.72 15.24h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M13.72 6.1h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M12.19 0h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="m13.72 22.86 -1.53 0 0 -7.62 1.53 0 0 -1.52 -1.53 0 0 -4.57 1.53 0 0 -1.53 -1.53 0 0 -6.09 -1.52 0 0 7.62 -1.52 0 0 1.52 1.52 0 0 3.05 -1.52 0 0 1.52 1.52 0 0 3.05 -1.52 0 0 1.52 1.52 0 0 3.05 -3.05 0 0 1.52 3.05 0 0 1.53 -3.05 0 0 1.52 -1.52 0 0 3.05 1.52 0 0 1.52 3.05 0 0 -1.52 1.52 0 0 -6.1 1.53 0 0 -1.52z" />
      <path fill="currentColor" d="M7.62 15.24h1.53v3.05H7.62Z" />
      <path fill="currentColor" d="M7.62 10.67h1.53v1.52H7.62Z" />
      <path fill="currentColor" d="M6.1 21.34h1.52v1.52H6.1Z" />
      <path fill="currentColor" d="M6.1 12.19h1.52v1.53H6.1Z" />
      <path fill="currentColor" d="M4.58 13.72H6.1v7.62H4.58Z" />
      <path fill="currentColor" d="M0 27.43h4.58v1.53H0Z" />
      <path fill="currentColor" d="M0 22.86h4.58v1.52H0Z" />
      <path fill="currentColor" d="M0 18.29h3.05v1.52H0Z" />
      <path fill="currentColor" d="M0 13.72h3.05v1.52H0Z" />
      <path fill="currentColor" d="M0 9.15h6.1v1.52H0Z" />
    </svg>
  );
}
