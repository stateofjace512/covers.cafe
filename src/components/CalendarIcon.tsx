interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function CalendarIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="m2.29 9.14 27.42 0 0 21.34 1.53 0 0 -25.91 -1.53 0 0 -1.52 -4.57 0 0 3.05 -1.52 0 0 -3.05 -15.24 0 0 3.05 -1.52 0 0 -3.05 -4.57 0 0 1.52 -1.53 0 0 25.91 1.53 0 0 -21.34z" />
      <path fill="currentColor" d="M2.29 30.48h27.42V32H2.29Z" />
      <path fill="currentColor" d="M23.62 0h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="m17.52 15.24 0 6.09 4.57 0 0 3.05 -4.57 0 0 1.52 6.1 0 0 -6.09 -4.57 0 0 -3.05 4.57 0 0 -1.52 -6.1 0z" />
      <path fill="currentColor" d="m12.95 15.24 -1.52 0 0 1.52 -3.05 0 0 1.53 3.05 0 0 6.09 -3.05 0 0 1.52 7.62 0 0 -1.52 -3.05 0 0 -9.14z" />
      <path fill="currentColor" d="M6.86 0h1.52v3.05H6.86Z" />
    </svg>
  );
}
