interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function XIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M0 0h4.57v4.57H0ZM27.43 0H32v4.57h-4.57ZM4.57 4.57h4.57v4.57H4.57ZM22.86 4.57h4.57v4.57h-4.57ZM9.14 9.14h4.57v4.57H9.14ZM18.29 9.14h4.57v4.57h-4.57ZM13.71 13.71h4.57v4.57h-4.57ZM9.14 18.29h4.57v4.57H9.14ZM18.29 18.29h4.57v4.57h-4.57ZM4.57 22.86h4.57v4.57H4.57ZM22.86 22.86h4.57v4.57h-4.57ZM0 27.43h4.57V32H0ZM27.43 27.43H32V32h-4.57Z" />
    </svg>
  );
}
