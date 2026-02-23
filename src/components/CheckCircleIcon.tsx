interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function CheckCircleIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M28.955 15.245h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M27.425 16.765h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M27.425 13.715h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M25.905 18.285h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M25.905 12.195h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="m24.385 24.385 -4.58 0 0 1.52 6.1 0 0 -6.09 -1.52 0 0 4.57z" />
      <path fill="currentColor" d="m15.235 16.765 -1.52 0 0 -1.52 -1.53 0 0 -1.53 -1.52 0 0 1.53 -1.52 0 0 1.52 1.52 0 0 1.52 1.52 0 0 1.53 1.53 0 0 1.52 1.52 0 0 -1.52 1.53 0 0 -1.53 1.52 0 0 -1.52 1.52 0 0 -1.52 1.53 0 0 -1.53 1.52 0 0 -1.52 -1.52 0 0 -1.53 -1.53 0 0 1.53 -1.52 0 0 1.52 -1.52 0 0 1.53 -1.53 0 0 1.52z" />
      <path fill="currentColor" d="m24.385 7.625 0 4.57 1.52 0 0 -6.1 -6.1 0 0 1.53 4.58 0z" />
      <path fill="currentColor" d="M18.285 25.905h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M18.285 4.575h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M16.765 27.435h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M16.765 3.055h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M15.235 28.955h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M15.235 1.525h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M13.715 27.435h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M13.715 3.055h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M12.185 25.905h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M12.185 4.575h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="m7.615 24.385 0 -4.57 -1.52 0 0 6.09 6.09 0 0 -1.52 -4.57 0z" />
      <path fill="currentColor" d="m7.615 7.625 4.57 0 0 -1.53 -6.09 0 0 6.1 1.52 0 0 -4.57z" />
      <path fill="currentColor" d="M4.575 18.285h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M4.575 12.195h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M3.045 16.765h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M3.045 13.715h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M1.525 15.245h1.52v1.52h-1.52Z" />
    </svg>
  );
}
