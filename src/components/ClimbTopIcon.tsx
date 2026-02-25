interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function ClimbTopIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M30.48 28.95H32V32h-1.52Z" />
      <path fill="currentColor" d="M30.48 10.67H32v1.52h-1.52Z" />
      <path fill="currentColor" d="M28.96 25.91h1.52v3.04h-1.52Z" />
      <path fill="currentColor" d="M28.96 9.14h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M27.43 22.86h1.53v3.05h-1.53Z" />
      <path fill="currentColor" d="M25.91 12.19h4.57v1.53h-4.57Z" />
      <path fill="currentColor" d="M27.43 7.62h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M25.91 19.81v-3.05h-1.52v-3.04h-1.53v-3.05h-1.52V9.14h-1.53V6.1h6.1V4.57h-1.52V3.05h-1.53v1.52h-3.05V1.53h1.53V0h-3.05v9.14h-1.52v1.53h-1.53v3.05h-1.52v3.04h-1.53v3.05h-1.52v3.05h3.05v1.52h4.57v-1.52h4.57v-1.52h3.05v1.52h1.52v-3.05Zm-9.14 3.05h-1.53v-1.52h1.53Zm4.57-1.52h-1.53v-1.53h-1.52v-1.52h1.52v1.52h1.53Zm0-6.1h-1.53v-3.05h-1.52v-1.52h1.52v1.52h1.53Zm3.05 4.57h-1.53v-1.52h1.53Z" />
      <path fill="currentColor" d="M25.91 9.14h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M24.39 10.67h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M21.34 1.53h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M9.15 22.86h1.52v3.05H9.15Z" />
      <path fill="currentColor" d="M9.15 6.1h1.52v1.52H9.15Z" />
      <path fill="currentColor" d="M7.62 25.91h1.53v3.04H7.62Z" />
      <path fill="currentColor" d="M7.62 4.57h1.53V6.1H7.62Z" />
      <path fill="currentColor" d="M6.1 28.95h1.52V32H6.1Z" />
      <path fill="currentColor" d="M6.1 24.38h1.52v1.53H6.1Z" />
      <path fill="currentColor" d="M1.53 7.62h7.62v1.52H1.53Z" />
      <path fill="currentColor" d="M4.58 3.05h3.04v1.52H4.58Z" />
      <path fill="currentColor" d="M4.58 22.86H6.1v1.52H4.58Z" />
      <path fill="currentColor" d="M3.05 24.38h1.53v1.53H3.05Z" />
      <path fill="currentColor" d="M1.53 4.57h3.05V6.1H1.53Z" />
      <path fill="currentColor" d="M1.53 25.91h1.52v3.04H1.53Z" />
      <path fill="currentColor" d="M0 28.95h1.53V32H0Z" />
      <path fill="currentColor" d="M0 6.1h1.53v1.52H0Z" />
    </svg>
  );
}
