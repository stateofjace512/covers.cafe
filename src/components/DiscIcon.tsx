interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function DiscIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="m30.48 9.14 -1.53 0 0 4.58 -6.09 0 0 1.52 1.52 0 0 1.52 1.53 0 0 -1.52 1.52 0 0 1.52 1.52 0 0 -1.52 1.53 0 0 1.52 -1.53 0 0 1.53 1.53 0 0 1.52 1.52 0 0 -7.62 -1.52 0 0 -3.05z" />
      <path fill="currentColor" d="m28.95 21.33 -1.52 0 0 -1.52 -1.52 0 0 -1.52 -1.53 0 0 1.52 -1.52 0 0 -1.52 -1.53 0 0 -1.53 1.53 0 0 -1.52 -1.53 0 0 -1.52 -1.52 0 0 4.57 -1.52 0 0 1.52 -4.58 0 0 1.52 4.58 0 0 1.53 1.52 0 0 3.05 1.52 0 0 3.04 -1.52 0 0 1.53 3.05 0 0 -1.53 3.05 0 0 -1.52 1.52 0 0 -1.52 1.52 0 0 -3.05 1.53 0 0 -3.05 -1.53 0 0 1.52z" />
      <path fill="currentColor" d="M27.43 18.29h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M27.43 6.1h1.52v3.04h-1.52Z" />
      <path fill="currentColor" d="M25.91 16.76h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M25.91 4.57h1.52V6.1h-1.52Z" />
      <path fill="currentColor" d="M22.86 16.76h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M22.86 3.05h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M19.81 1.53h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M18.29 12.19h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M12.19 30.48h7.62V32h-7.62Z" />
      <path fill="currentColor" d="M18.29 13.72h-4.58v4.57h4.58Zm-1.53 3.04h-1.52v-1.52h1.52Z" />
      <path fill="currentColor" d="m13.71 6.1 1.53 0 0 -4.57 4.57 0 0 -1.53 -7.62 0 0 1.53 1.52 0 0 4.57z" />
      <path fill="currentColor" d="M12.19 18.29h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M9.14 28.95h3.05v1.53H9.14Z" />
      <path fill="currentColor" d="m12.19 13.72 1.52 0 0 -1.53 4.58 0 0 -1.52 -1.53 0 0 -4.57 -1.52 0 0 4.57 -1.53 0 0 -1.53 -1.52 0 0 3.05 -3.05 0 0 1.53 1.53 0 0 4.57 1.52 0 0 -4.57z" />
      <path fill="currentColor" d="M10.67 6.1h1.52v3.04h-1.52Z" />
      <path fill="currentColor" d="M9.14 24.38h3.05v1.53H9.14Z" />
      <path fill="currentColor" d="M6.1 27.43h3.04v1.52H6.1Z" />
      <path fill="currentColor" d="M7.62 22.86h1.52v1.52H7.62Z" />
      <path fill="currentColor" d="M6.1 10.67h3.04v1.52H6.1Z" />
      <path fill="currentColor" d="m9.14 6.1 1.53 0 0 -3.05 1.52 0 0 -1.52 -3.05 0 0 1.52 -3.04 0 0 1.52 3.04 0 0 1.53z" />
      <path fill="currentColor" d="M6.1 19.81h1.52v3.05H6.1Z" />
      <path fill="currentColor" d="M4.57 25.91H6.1v1.52H4.57Z" />
      <path fill="currentColor" d="M4.57 4.57H6.1V6.1H4.57Z" />
      <path fill="currentColor" d="M3.05 22.86h1.52v3.05H3.05Z" />
      <path fill="currentColor" d="M1.52 19.81h1.53v3.05H1.52Z" />
      <path fill="currentColor" d="m3.05 10.67 3.05 0 0 -1.53 -1.53 0 0 -3.04 -1.52 0 0 3.04 -1.53 0 0 3.05 1.53 0 0 -1.52z" />
      <path fill="currentColor" d="M0 12.19h1.52v7.62H0Z" />
    </svg>
  );
}
