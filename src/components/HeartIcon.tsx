interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function HeartIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M30.47 12.19H32v7.62h-1.53Z" />
      <path fill="currentColor" d="M28.95 19.81h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M28.95 9.14h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M27.43 22.86h1.52v3.04h-1.52Z" />
      <path fill="currentColor" d="M27.43 6.09h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M25.9 25.9h1.53v1.53H25.9Z" />
      <path fill="currentColor" d="M25.9 4.57h1.53v1.52H25.9Z" />
      <path fill="currentColor" d="M22.85 27.43h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M24.38 10.67h-1.53V9.14h-4.57v1.53h-1.52v1.52h-1.53v-1.52h-1.52V9.14H9.14v1.53H7.62v1.52H6.09v4.57h1.53v1.53h1.52v1.52h1.52v1.52h1.53v1.53h1.52v1.52h1.52v1.52h1.53v-1.52h1.52v-1.52h1.53v-1.53h1.52v-1.52h1.52v-1.52h1.53v-1.53h1.52v-4.57h-1.52Zm-1.53 6.09h-1.52v-3.05h-3.05v-1.52h3.05v1.52h1.52Z" />
      <path fill="currentColor" d="M22.85 3.05h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M19.81 28.95h3.04v1.53h-3.04Z" />
      <path fill="currentColor" d="M19.81 1.52h3.04v1.53h-3.04Z" />
      <path fill="currentColor" d="M12.19 30.48h7.62V32h-7.62Z" />
      <path fill="currentColor" d="M12.19 0h7.62v1.52h-7.62Z" />
      <path fill="currentColor" d="M9.14 28.95h3.05v1.53H9.14Z" />
      <path fill="currentColor" d="M9.14 1.52h3.05v1.53H9.14Z" />
      <path fill="currentColor" d="M6.09 27.43h3.05v1.52H6.09Z" />
      <path fill="currentColor" d="M6.09 3.05h3.05v1.52H6.09Z" />
      <path fill="currentColor" d="M4.57 25.9h1.52v1.53H4.57Z" />
      <path fill="currentColor" d="M4.57 4.57h1.52v1.52H4.57Z" />
      <path fill="currentColor" d="M3.04 22.86h1.53v3.04H3.04Z" />
      <path fill="currentColor" d="M3.04 6.09h1.53v3.05H3.04Z" />
      <path fill="currentColor" d="M1.52 19.81h1.52v3.05H1.52Z" />
      <path fill="currentColor" d="M1.52 9.14h1.52v3.05H1.52Z" />
      <path fill="currentColor" d="M0 12.19h1.52v7.62H0Z" />
    </svg>
  );
}
