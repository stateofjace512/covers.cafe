interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function TrophyIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M29.715 5.34h1.52v7.61h-1.52Z" />
      <path fill="currentColor" d="m26.665 5.34 3.05 0 0 -1.53 -3.05 0 0 -1.52 -1.52 0 0 15.24 1.52 0 0 -3.05 3.05 0 0 -1.53 -3.05 0 0 -7.61z" />
      <path fill="currentColor" d="M23.615 17.53h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M22.095 19.05h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="m9.905 29.72 0 -1.53 -1.52 0 0 1.53 -1.53 0 0 1.52 18.29 0 0 -1.52 -1.53 0 0 -1.53 -1.52 0 0 1.53 -12.19 0z" />
      <path fill="currentColor" d="M19.045 26.67h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M19.045 20.57h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="m17.525 8.38 0 -3.04 -3.05 0 0 3.04 -4.57 0 0 1.53 1.52 0 0 1.52 1.53 0 0 1.52 -1.53 0 0 3.05 3.05 0 0 -1.52 3.05 0 0 1.52 3.05 0 0 -3.05 -1.53 0 0 -1.52 1.53 0 0 -1.52 1.52 0 0 -1.53 -4.57 0z" />
      <path fill="currentColor" d="M17.525 22.1h1.52v4.57h-1.52Z" />
      <path fill="currentColor" d="M12.955 22.1h1.52v4.57h-1.52Z" />
      <path fill="currentColor" d="M9.905 26.67h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M9.905 20.57h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="M8.385 19.05h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M6.855 0.76h18.29v1.53H6.855Z" />
      <path fill="currentColor" d="M6.855 17.53h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="m6.855 2.29 -1.52 0 0 1.52 -3.05 0 0 1.53 3.05 0 0 7.61 -3.05 0 0 1.53 3.05 0 0 3.05 1.52 0 0 -15.24z" />
      <path fill="currentColor" d="M0.765 5.34h1.52v7.61H0.765Z" />
    </svg>
  );
}
