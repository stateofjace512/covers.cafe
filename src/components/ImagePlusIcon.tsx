interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function ImagePlusIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M28.95 24.38V3.05H7.62V0H3.05v3.05H0v4.57h3.05v21.33h21.33V32h4.57v-3.05H32v-4.57Zm1.53 3.05h-3.05v3.05h-1.52v-3.05H4.57V6.1H1.53V4.57h3.04V1.52H6.1v3.05h21.33v21.34h3.05Z" />
      <path fill="currentColor" d="M6.1 6.1v19.81h19.81V6.1Zm18.28 9.14h-4.57v1.52h4.57v7.62h-4.57v-1.52h-1.52v1.52H7.62v-1.52h1.53v-1.53H7.62V7.62h16.76Z" />
      <path fill="currentColor" d="M18.29 16.76h1.52v1.53h-1.52Z" />
      <path fill="currentColor" d="M16.76 18.29h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M16.76 21.33h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M15.24 19.81h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="m10.67 15.24 3.05 0 0 -1.53 1.52 0 0 -3.04 -1.52 0 0 -1.53 -3.05 0 0 1.53 -1.52 0 0 3.04 1.52 0 0 1.53z" />
      <path fill="currentColor" d="M10.67 18.29h4.57v1.52h-4.57Z" />
      <path fill="currentColor" d="M9.15 19.81h1.52v1.52H9.15Z" />
    </svg>
  );
}
