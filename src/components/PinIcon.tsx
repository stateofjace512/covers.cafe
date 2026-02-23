interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function PinIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M29.715 8.38h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M28.195 6.86h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M26.665 11.43h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M26.665 5.33h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M25.145 9.9h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M25.145 3.81h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M23.615 11.43h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M23.615 8.38h1.53V9.9h-1.53Z" />
      <path fill="currentColor" d="M23.615 2.28h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M22.095 17.52h1.52v4.57h-1.52Z" />
      <path fill="currentColor" d="M22.095 12.95h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M22.095 6.86h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M20.575 0.76h3.04v1.52h-3.04Z" />
      <path fill="currentColor" d="M20.575 22.09h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M20.575 14.47h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M20.575 5.33h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M19.045 25.14h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M19.045 6.86h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M19.045 2.28h1.53v3.05h-1.53Z" />
      <path fill="currentColor" d="M17.525 16h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M17.525 8.38h1.52V9.9h-1.52Z" />
      <path fill="currentColor" d="M16.005 26.66h3.04v1.53h-3.04Z" />
      <path fill="currentColor" d="M16.005 14.47h1.52V16h-1.52Z" />
      <path fill="currentColor" d="M14.475 25.14h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M14.475 12.95h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M14.475 9.9h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="M12.955 23.62h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="m3.815 29.71 1.52 0 0 -1.52 1.52 0 0 -1.53 1.53 0 0 -1.52 1.52 0 0 -1.52 3.05 0 0 -1.53 -1.53 0 0 -1.52 -1.52 0 0 -1.52 -1.52 0 0 3.04 -1.53 0 0 1.53 -1.52 0 0 1.52 -1.52 0 0 1.52 -1.53 0 0 1.53 -1.52 0 0 3.05 3.05 0 0 -1.53z" />
      <path fill="currentColor" d="M9.905 8.38h4.57V9.9h-4.57Z" />
      <path fill="currentColor" d="M6.855 9.9h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="M6.855 17.52h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M5.335 16h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M5.335 11.43h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M3.815 12.95h1.52V16h-1.52Z" />
    </svg>
  );
}
