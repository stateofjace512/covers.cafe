interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function TrashIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="m25.905 8.38 0 16.76 1.53 0 0 -16.76 3.04 0 0 -1.52 -1.52 0 0 -1.53 -6.1 0 0 -3.05 -1.52 0 0 3.05 -10.67 0 0 -3.05 -1.52 0 0 3.05 -6.09 0 0 1.53 -1.53 0 0 1.52 3.05 0 0 16.76 1.52 0 0 -16.76 19.81 0z" />
      <path fill="currentColor" d="M24.385 25.14h1.52v4.57h-1.52Z" />
      <path fill="currentColor" d="M7.625 29.71h16.76v1.53H7.625Z" />
      <path fill="currentColor" d="M21.335 11.43h1.52v12.19h-1.52Z" />
      <path fill="currentColor" d="M19.815 23.62h1.52v3.04h-1.52Z" />
      <path fill="currentColor" d="M15.245 11.43h1.52v15.23h-1.52Z" />
      <path fill="currentColor" d="M10.665 0.76h10.67v1.52h-10.67Z" />
      <path fill="currentColor" d="M10.665 23.62h1.53v3.04h-1.53Z" />
      <path fill="currentColor" d="M9.145 11.43h1.52v12.19h-1.52Z" />
      <path fill="currentColor" d="M6.095 25.14h1.53v4.57h-1.53Z" />
    </svg>
  );
}
