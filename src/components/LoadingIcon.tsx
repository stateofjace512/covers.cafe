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
      <path fill="currentColor" d="M0 0h32v3.05H0Z" />
      <path fill="currentColor" d="M0 3.05h3.05v28.95H0Z" />
      <path fill="currentColor" d="M3.05 28.95h9.14V32H3.05Z" />
    </svg>
  );
}
