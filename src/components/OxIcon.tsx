interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function OxIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M30.48 13.72H32v1.52h-1.52Z" />
      <path fill="currentColor" d="M30.48 4.57H32v4.58h-1.52Z" />
      <path fill="currentColor" d="M28.95 12.19h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M28.95 9.15h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M28.95 3.05h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="m24.38 15.24 0 4.57 1.53 0 0 -3.05 4.57 0 0 -1.52 -6.1 0z" />
      <path fill="currentColor" d="m27.43 3.05 1.52 0 0 -1.52 1.53 0 0 -1.53 -4.57 0 0 1.53 1.52 0 0 1.52z" />
      <path fill="currentColor" d="M25.91 10.67h3.04v1.52h-3.04Z" />
      <path fill="currentColor" d="m27.43 4.57 -1.52 0 0 1.53 -1.53 0 0 1.52 3.05 0 0 -3.05z" />
      <path fill="currentColor" d="M24.38 1.53h1.53v3.04h-1.53Z" />
      <path fill="currentColor" d="M22.86 19.81h1.52v4.57h-1.52Z" />
      <path fill="currentColor" d="M22.86 13.72h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M22.86 7.62h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M21.34 22.86h-4.58v1.52h-1.52v-1.52h-4.57v1.52H9.15v1.53H7.62v3.05h1.53v1.52h1.52V32h10.67v-1.52h1.52v-1.52h1.52v-3.05h-1.52v-1.53h-1.52Zm-1.53 4.57h-1.52v1.53h-4.57v-1.53h-1.53v-1.52h3.05v1.52h1.52v-1.52h3.05Z" />
      <path fill="currentColor" d="M19.81 16.76h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M19.81 6.1h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M18.29 18.29h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M12.19 4.57h7.62V6.1h-7.62Z" />
      <path fill="currentColor" d="M12.19 18.29h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M10.67 16.76h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M9.15 6.1h3.04v1.52H9.15Z" />
      <path fill="currentColor" d="M7.62 19.81h1.53v4.57H7.62Z" />
      <path fill="currentColor" d="M7.62 7.62h1.53v1.53H7.62Z" />
      <path fill="currentColor" d="m7.62 15.24 -6.09 0 0 1.52 4.57 0 0 3.05 1.52 0 0 -4.57z" />
      <path fill="currentColor" d="M6.1 1.53h1.52v3.04H6.1Z" />
      <path fill="currentColor" d="M3.05 10.67H6.1v1.52H3.05Z" />
      <path fill="currentColor" d="m4.57 7.62 3.05 0 0 -1.52 -1.52 0 0 -1.53 -1.53 0 0 3.05z" />
      <path fill="currentColor" d="m4.57 1.53 1.53 0L6.1 0 1.53 0l0 1.53 1.52 0 0 1.52 1.52 0 0 -1.52z" />
      <path fill="currentColor" d="M1.53 12.19h1.52v1.53H1.53Z" />
      <path fill="currentColor" d="M1.53 9.15h1.52v1.52H1.53Z" />
      <path fill="currentColor" d="M1.53 3.05h1.52v1.52H1.53Z" />
      <path fill="currentColor" d="M0 13.72h1.53v1.52H0Z" />
      <path fill="currentColor" d="M0 4.57h1.53v4.58H0Z" />
    </svg>
  );
}
