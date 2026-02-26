interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function PaginatePictureIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M29.71 2.28h1.53v22.86h-1.53Z" />
      <path fill="currentColor" d="m6.85 25.14 0 1.52 1.53 0 0 1.53 1.52 0 0 -1.53 3.05 0 0 1.53 1.52 0 0 -1.53 3.05 0 0 1.53 1.52 0 0 -1.53 3.05 0 0 1.53 1.53 0 0 -1.53 1.52 0 0 1.53 -1.52 0 0 1.52 -3.05 0 0 -1.52 -1.53 0 0 1.52 -3.04 0 0 -1.52 -1.53 0 0 1.52 -3.04 0 0 -1.52 -1.53 0 0 1.52 -3.05 0 0 -1.52 -1.52 0 0 1.52 -3.05 0 0 1.53 22.86 0 0 -1.53 1.52 0 0 -3.05 3.05 0 0 -1.52 -22.86 0z" />
      <path fill="currentColor" d="m26.66 12.95 -3.04 0 0 1.52 3.04 0 0 4.58 1.53 0 0 -13.72 -1.53 0 0 7.62z" />
      <path fill="currentColor" d="m23.62 17.52 -1.53 0 0 1.53 -12.19 0 0 1.52 16.76 0 0 -1.52 -3.04 0 0 -1.53z" />
      <path fill="currentColor" d="M22.09 6.85h3.05V9.9h-3.05Z" />
      <path fill="currentColor" d="M22.09 14.47h1.53V16h-1.53Z" />
      <path fill="currentColor" d="M20.57 16h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M19.04 14.47h1.53V16h-1.53Z" />
      <path fill="currentColor" d="M17.52 12.95h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M14.47 11.43h3.05v1.52h-3.05Z" />
      <path fill="currentColor" d="M12.95 12.95h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M11.43 14.47h1.52V16h-1.52Z" />
      <path fill="currentColor" d="M9.9 3.81h16.76v1.52H9.9Z" />
      <path fill="currentColor" d="m11.43 17.52 0 -1.52 -1.53 0 0 -10.67 -1.52 0 0 13.72 1.52 0 0 -1.53 1.53 0z" />
      <path fill="currentColor" d="M6.85 0.76h22.86v1.52H6.85Z" />
      <path fill="currentColor" d="M3.81 26.66h1.52v1.53H3.81Z" />
      <path fill="currentColor" d="m3.81 26.66 0 -1.52 -1.53 0 0 -3.05 1.53 0 0 -1.52 -1.53 0 0 -3.05 1.53 0 0 -1.52 -1.53 0 0 -3.05 1.53 0 0 -1.52 -1.53 0 0 -3.05 1.53 0 0 -1.53 1.52 0 0 1.53 -1.52 0 0 1.52 1.52 0 0 3.05 -1.52 0 0 1.52 1.52 0 0 3.05 -1.52 0 0 1.53 1.52 0 0 3.04 -1.52 0 0 1.53 1.52 0 0 1.52 1.52 0 0 -22.86 -1.52 0 0 3.05 -3.05 0 0 1.52 -1.52 0 0 22.86 1.52 0 0 -3.05 1.53 0z" />
    </svg>
  );
}
