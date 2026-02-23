interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function TagIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M30.48 4.57H32v24.38h-1.52Z" />
      <path fill="currentColor" d="M28.95 28.95h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M28.95 3.05h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M3.05 30.48h25.9V32H3.05Z" />
      <path fill="currentColor" d="M6.1 24.38h19.81v1.53H6.1Z" />
      <path fill="currentColor" d="M6.1 18.29h19.81v1.52H6.1Z" />
      <path fill="currentColor" d="M18.29 12.19h7.62v1.52h-7.62Z" />
      <path fill="currentColor" d="M18.29 7.62h7.62v1.52h-7.62Z" />
      <path fill="currentColor" d="M7.62 3.05v10.66h1.52v-1.52h1.53v-1.52h1.52v1.52h1.52v1.52h1.53V3.05h13.71V1.52H13.71V0H4.57v1.52H1.52v1.53Zm3.05 -1.53h1.52v1.53h1.52V6.1h-1.52V3.05h-1.52Z" />
      <path fill="currentColor" d="M1.52 28.95h1.53v1.53H1.52Z" />
      <path fill="currentColor" d="M0 3.05h1.52v25.9H0Z" />
    </svg>
  );
}
