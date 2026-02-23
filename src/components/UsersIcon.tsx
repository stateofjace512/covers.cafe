interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function UsersIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M30.48 18.285H32v1.53h-1.52Z" />
      <path fill="currentColor" d="M27.43 16.765h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M27.43 13.715h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="m22.86 15.245 0 -3.05 -1.52 0 0 -1.53 -1.53 0 0 -3.04 1.53 0 0 -1.53 6.09 0 0 1.53 1.52 0 0 6.09 1.53 0 0 -9.14 -1.53 0 0 -1.53 -1.52 0 0 -1.52 -6.09 0 0 1.52 -1.53 0 0 1.53 -1.52 0 0 4.57 -4.57 0 0 -4.57 -1.53 0 0 -1.53 -1.52 0 0 -1.52 -6.1 0 0 1.52 -1.52 0 0 1.53 -1.52 0 0 9.14 1.52 0 0 -6.09 1.52 0 0 -1.53 6.1 0 0 1.53 1.52 0 0 3.04 -1.52 0 0 1.53 -1.52 0 0 3.05 -4.58 0 0 1.52 4.58 0 0 6.09 1.52 0 0 -7.61 1.52 0 0 -1.53 7.62 0 0 1.53 1.53 0 0 7.61 1.52 0 0 -6.09 4.57 0 0 -1.52 -4.57 0z" />
      <path fill="currentColor" d="M24.38 28.955h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M22.86 27.435h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M19.81 25.905h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="M19.81 22.855h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M18.29 16.765h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M12.19 24.385h7.62v1.52h-7.62Z" />
      <path fill="currentColor" d="M13.72 21.335h4.57v1.52h-4.57Z" />
      <path fill="currentColor" d="M12.19 16.765h1.53v3.05h-1.53Z" />
      <path fill="currentColor" d="M10.67 22.855h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M9.15 25.905h3.04v1.53H9.15Z" />
      <path fill="currentColor" d="M7.62 27.435h1.53v1.52H7.62Z" />
      <path fill="currentColor" d="M6.1 28.955h1.52v1.52H6.1Z" />
      <path fill="currentColor" d="M3.05 13.715h1.52v1.53H3.05Z" />
      <path fill="currentColor" d="M1.53 16.765h3.04v1.52H1.53Z" />
      <path fill="currentColor" d="M0 18.285h1.53v1.53H0Z" />
    </svg>
  );
}
