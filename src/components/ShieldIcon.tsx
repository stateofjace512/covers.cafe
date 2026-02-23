interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function ShieldIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="m25.91 4.57 0 1.53 1.52 0 0 15.24 1.52 0 0 -16.77 -1.52 0 0 -1.52 -3.05 0 0 1.52 1.53 0z" />
      <path fill="currentColor" d="M25.91 21.34h1.52v3.04h-1.52Z" />
      <path fill="currentColor" d="M24.38 24.38h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M24.38 6.1h1.53v15.24h-1.53Z" />
      <path fill="currentColor" d="M22.86 25.91h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M22.86 21.34h1.52v3.04h-1.52Z" />
      <path fill="currentColor" d="M21.34 27.43h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M21.34 24.38h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M21.34 4.57h3.04V6.1h-3.04Z" />
      <path fill="currentColor" d="M21.34 1.53h3.04v1.52h-3.04Z" />
      <path fill="currentColor" d="M18.29 28.96h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M18.29 25.91h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M13.72 13.72v-3.05h-1.53v3.05h-1.52v7.62h1.52v1.52h7.62v-1.52h1.53v-7.62h-1.53v-3.05h-1.52v3.05Zm3.04 4.57h-1.52v-3.05h1.52Z" />
      <path fill="currentColor" d="M13.72 30.48h4.57V32h-4.57Z" />
      <path fill="currentColor" d="M13.72 27.43h4.57v1.53h-4.57Z" />
      <path fill="currentColor" d="M13.72 9.15h4.57v1.52h-4.57Z" />
      <path fill="currentColor" d="M10.67 28.96h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M10.67 25.91h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M10.67 3.05h10.67v1.52H10.67Z" />
      <path fill="currentColor" d="M10.67 0h10.67v1.53H10.67Z" />
      <path fill="currentColor" d="M9.14 27.43h1.53v1.53H9.14Z" />
      <path fill="currentColor" d="M9.14 24.38h1.53v1.53H9.14Z" />
      <path fill="currentColor" d="M7.62 4.57h3.05V6.1H7.62Z" />
      <path fill="currentColor" d="M7.62 1.53h3.05v1.52H7.62Z" />
      <path fill="currentColor" d="M7.62 25.91h1.52v1.52H7.62Z" />
      <path fill="currentColor" d="M7.62 21.34h1.52v3.04H7.62Z" />
      <path fill="currentColor" d="M6.1 24.38h1.52v1.53H6.1Z" />
      <path fill="currentColor" d="M6.1 6.1h1.52v15.24H6.1Z" />
      <path fill="currentColor" d="M4.57 3.05h3.05v1.52H4.57Z" />
      <path fill="currentColor" d="M4.57 21.34H6.1v3.04H4.57Z" />
      <path fill="currentColor" d="M3.05 4.57h1.52v16.77H3.05Z" />
    </svg>
  );
}
