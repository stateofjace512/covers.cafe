interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function FavoritesIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M30.48 10.66h-9.15v1.53h-1.52v1.52h-1.52v1.52h-1.53V4.57h1.53V1.52h-1.53V0h-1.52v1.52h-1.53v3.05h-1.52v3.05h-1.52v3.04H1.52v1.53H0v1.52h1.52v1.52h1.53v1.53H6.1v1.52h1.52v3.05h1.52v-1.52h3.05v-1.53h3.05v1.53h-1.53v1.52h-1.52v1.52h-1.52v1.53H9.14v1.52H7.62v1.53H6.1v1.52H4.57v-1.52H3.05v3.04h1.52V32h3.05v-1.53h1.52v-1.52h3.05v-1.52h1.52V25.9h1.53v-1.52h1.52v-4.57h1.53v1.52h1.52v1.52h1.52v1.53h1.53v1.52h1.52v1.53h1.52v3.04h-1.52V32h3.05v-1.53h1.52v-3.04h-1.52v-3.05H25.9v-3.05h-1.52v-3.05h1.52v-1.52h-3.04v1.52h-6.1v-1.52h4.57v-1.53h1.53v-1.52h6.09v1.52h1.53v-1.52H32v-1.52h-1.52Zm-16.77 6.1h-3.04v-1.53H7.62v-1.52H4.57v-1.52h7.62v1.52h1.52Z" />
      <path fill="currentColor" d="M25.9 15.23h3.05v1.53H25.9Z" />
      <path fill="currentColor" d="M22.86 28.95h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M19.81 27.43h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M19.81 7.62h1.52v3.04h-1.52Z" />
      <path fill="currentColor" d="M18.29 25.9h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M18.29 4.57h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M16.76 24.38h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M6.1 21.33h1.52v3.05H6.1Z" />
      <path fill="currentColor" d="M4.57 24.38H6.1v3.05H4.57Z" />
    </svg>
  );
}
