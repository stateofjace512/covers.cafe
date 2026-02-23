interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function PlusIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M13.71 0h4.57v32h-4.57ZM0 13.71h32v4.57H0Z" />
    </svg>
  );
}
