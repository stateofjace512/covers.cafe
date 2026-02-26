interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function SmartEmojiIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M30.48 12.19H32v7.62h-1.52Z" />
      <path fill="currentColor" d="M28.95 19.81h1.53v3.04h-1.53Z" />
      <path fill="currentColor" d="M27.43 22.85h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M27.43 6.09h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M25.91 25.9h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M25.91 4.57h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M22.86 27.42h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="M22.86 3.04h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="M19.81 28.95h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M19.81 1.52h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M12.19 30.47h7.62V32h-7.62Z" />
      <path fill="currentColor" d="M13.72 22.85h6.09v1.53h-6.09Z" />
      <path fill="currentColor" d="M12.19 0h7.62v1.52h-7.62Z" />
      <path fill="currentColor" d="M12.19 21.33h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M9.14 28.95h3.05v1.52H9.14Z" />
      <path fill="currentColor" d="M9.14 1.52h3.05v1.52H9.14Z" />
      <path fill="currentColor" d="M6.1 27.42h3.04v1.53H6.1Z" />
      <path fill="currentColor" d="M6.1 3.04h3.04v1.53H6.1Z" />
      <path fill="currentColor" d="M4.57 25.9H6.1v1.52H4.57Z" />
      <path fill="currentColor" d="M4.57 4.57H6.1v1.52H4.57Z" />
      <path fill="currentColor" d="M3.05 22.85h1.52v3.05H3.05Z" />
      <path fill="currentColor" d="m3.05 15.23 1.52 0 0 1.53 1.53 0 0 1.52 6.09 0 0 -1.52 1.53 0 0 -1.53 1.52 0 0 -1.52 3.05 0 0 1.52 1.52 0 0 1.53 1.52 0 0 1.52 6.1 0 0 -1.52 1.52 0 0 -4.57 1.53 0 0 -3.05 -1.53 0 0 1.52 -25.9 0 0 -1.52 -1.52 0 0 3.05 1.52 0 0 3.04z" />
      <path fill="currentColor" d="M3.05 6.09h1.52v3.05H3.05Z" />
      <path fill="currentColor" d="M1.53 19.81h1.52v3.04H1.53Z" />
      <path fill="currentColor" d="M0 12.19h1.53v7.62H0Z" />
    </svg>
  );
}
