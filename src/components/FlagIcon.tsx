interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function FlagIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M29.715 21.335h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M29.715 6.095h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M28.195 18.285h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="M28.195 7.615h1.52v3.05h-1.52Z" />
      <path fill="currentColor" d="m19.045 22.855 0 -16.76 10.67 0 0 -1.52 -10.67 0 0 -1.53 -1.52 0 0 16.76 -15.24 0 0 -16.76 -1.52 0 0 27.43 1.52 0 0 -9.14 12.19 0 0 1.52 1.53 0 0 1.52 13.71 0 0 -1.52 -10.67 0z" />
      <path fill="currentColor" d="M26.665 15.235h1.53v3.05h-1.53Z" />
      <path fill="currentColor" d="M26.665 10.665h1.53v3.05h-1.53Z" />
      <path fill="currentColor" d="M25.145 13.715h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M2.285 1.525h15.24v1.52H2.285Z" />
    </svg>
  );
}
