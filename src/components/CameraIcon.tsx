interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function CameraIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="m19.05 13.72 0 1.52 1.52 0 0 6.1 1.52 0 0 -6.1 7.62 0 0 9.14 1.53 0 0 -16.76 -1.53 0 0 6.1 -10.66 0z" />
      <path fill="currentColor" d="M28.19 24.38h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M28.19 6.1h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M26.67 9.15h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M3.81 25.91h24.38v1.52H3.81Z" />
      <path fill="currentColor" d="M22.09 10.67h4.58v1.52h-4.58Z" />
      <path fill="currentColor" d="M22.09 7.62h4.58v1.53h-4.58Z" />
      <path fill="currentColor" d="M20.57 9.15h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M19.05 21.34h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M17.52 4.57h10.67V6.1H17.52Z" />
      <path fill="currentColor" d="m14.48 21.34 3.04 0 0 -1.53 1.53 0 0 -3.05 -1.53 0 0 1.53 -1.52 0 0 -1.53 1.52 0 0 -1.52 -3.04 0 0 1.52 -1.53 0 0 3.05 1.53 0 0 1.53z" />
      <path fill="currentColor" d="M12.95 12.19h6.1v1.53h-6.1Z" />
      <path fill="currentColor" d="M12.95 22.86h6.1v1.52h-6.1Z" />
      <path fill="currentColor" d="M16 6.1h1.52v1.52H16Z" />
      <path fill="currentColor" d="M11.43 21.34h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M8.38 4.57h4.57V6.1H8.38Z" />
      <path fill="currentColor" d="M5.33 10.67h3.05v1.52H5.33Z" />
      <path fill="currentColor" d="m16 9.15 0 -1.53 -1.52 0 0 -1.52 -1.53 0 0 1.52 -4.57 0 0 -1.52 -1.52 0 0 1.52 -3.05 0 0 1.53 12.19 0z" />
      <path fill="currentColor" d="M2.28 24.38h1.53v1.53H2.28Z" />
      <path fill="currentColor" d="M2.28 9.15h1.53v1.52H2.28Z" />
      <path fill="currentColor" d="m2.28 15.24 7.62 0 0 6.1 1.53 0 0 -6.1 1.52 0 0 -1.52 -10.67 0 0 -3.05 -1.52 0 0 13.71 1.52 0 0 -9.14z" />
    </svg>
  );
}
