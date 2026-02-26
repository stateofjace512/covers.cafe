interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function ShieldGuardPixelIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M27.43 4.57h1.52v16.76h-1.52Z" />
      <path fill="currentColor" d="M25.9 21.33h1.53v3.05H25.9Z" />
      <path fill="currentColor" d="M24.38 24.38h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="m10.66 4.57 -3.04 0 0 1.53 -1.53 0 0 15.23 1.53 0 0 -6.09 7.62 0 0 12.19 -1.53 0 0 1.52 4.57 0 0 -1.52 3.05 0 0 -1.53 1.52 0 0 -1.52 1.53 0 0 -3.05 1.52 0 0 -15.23 -1.52 0 0 9.14 -7.62 0 0 -10.67 4.57 0 0 -1.52 -10.67 0 0 1.52z" />
      <path fill="currentColor" d="M24.38 3.05h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M22.85 25.9h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M21.33 27.43h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M21.33 4.57h3.05V6.1h-3.05Z" />
      <path fill="currentColor" d="M21.33 1.52h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="M18.28 28.95h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="M13.71 30.48h4.57V32h-4.57Z" />
      <path fill="currentColor" d="M10.66 28.95h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="M10.66 25.9h3.05v1.53h-3.05Z" />
      <path fill="currentColor" d="M10.66 0h10.67v1.52H10.66Z" />
      <path fill="currentColor" d="M9.14 27.43h1.52v1.52H9.14Z" />
      <path fill="currentColor" d="M9.14 24.38h1.52v1.52H9.14Z" />
      <path fill="currentColor" d="M7.62 1.52h3.04v1.53H7.62Z" />
      <path fill="currentColor" d="M7.62 25.9h1.52v1.53H7.62Z" />
      <path fill="currentColor" d="M7.62 21.33h1.52v3.05H7.62Z" />
      <path fill="currentColor" d="M6.09 24.38h1.53v1.52H6.09Z" />
      <path fill="currentColor" d="M4.57 3.05h3.05v1.52H4.57Z" />
      <path fill="currentColor" d="M4.57 21.33h1.52v3.05H4.57Z" />
      <path fill="currentColor" d="M3.05 4.57h1.52v16.76H3.05Z" />
    </svg>
  );
}
