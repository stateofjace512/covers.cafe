interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function LoadingIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M27.43 12.19h1.52v7.62h-1.52Z" />
      <path fill="currentColor" d="M25.91 19.81h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M25.91 9.14h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="m27.43 7.62 0-1.52 1.52 0 0-1.53-7.62 0 0 7.62 1.53 0 0-1.52 1.52 0 0-1.53 1.53 0 0-1.52 1.52 0z" />
      <path fill="currentColor" d="M24.38 22.86h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M22.86 24.38h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M19.81 25.91h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M13.71 27.43h6.1v1.52h-6.1Z" />
      <path fill="currentColor" d="M12.19 3.05h6.1v1.52h-6.1Z" />
      <path fill="currentColor" d="M9.14 4.57h3.05V6.1H9.14Z" />
      <path fill="currentColor" d="M7.62 6.1h1.52v1.52H7.62Z" />
      <path fill="currentColor" d="M6.1 7.62h1.52v1.52H6.1Z" />
      <path fill="currentColor" d="m4.57 24.38 0 1.53-1.52 0 0 1.52 7.62 0 0-7.62-1.53 0 0 1.52-1.52 0 0 1.53-1.52 0 0 1.52-1.53 0z" />
      <path fill="currentColor" d="M4.57 19.81H6.1v3.05H4.57Z" />
      <path fill="currentColor" d="M4.57 9.14H6.1v3.05H4.57Z" />
      <path fill="currentColor" d="M3.05 12.19h1.52v7.62H3.05Z" />
    </svg>
  );
}
