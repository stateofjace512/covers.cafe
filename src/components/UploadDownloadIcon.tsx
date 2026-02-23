interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function UploadDownloadIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="m28.955 22.85 -25.9 0 0 -15.23 -1.53 0 0 18.28 1.53 0 0 1.53 9.14 0 0 1.52 1.52 0 0 -1.52 4.57 0 0 1.52 1.53 0 0 -1.52 9.14 0 0 -1.53 1.52 0 0 -18.28 -1.52 0 0 15.23z" />
      <path fill="currentColor" d="M22.865 6.09h6.09v1.53h-6.09Z" />
      <path fill="currentColor" d="m12.195 30.47 0 -1.52 -1.52 0 0 3.05 10.66 0 0 -3.05 -1.52 0 0 1.52 -7.62 0z" />
      <path fill="currentColor" d="M13.715 15.24h4.57v1.52h-4.57Z" />
      <path fill="currentColor" d="M13.715 18.28h4.57v1.53h-4.57Z" />
      <path fill="currentColor" d="m15.245 0 0 1.52 -1.53 0 0 1.53 -1.52 0 0 1.52 -1.52 0 0 1.52 3.04 0 0 7.62 4.57 0 0 -7.62 3.05 0 0 -1.52 -1.52 0 0 -1.52 -1.53 0 0 -1.53 -1.52 0 0 -1.52 -1.52 0z" />
      <path fill="currentColor" d="M3.055 6.09h6.09v1.53h-6.09Z" />
    </svg>
  );
}
