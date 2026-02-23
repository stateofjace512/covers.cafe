interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function ChevronDownIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M0 8h4v4H0ZM28 8h4v4h-4ZM4 12h4v4H4ZM24 12h4v4h-4ZM8 16h4v4H8ZM20 16h4v4h-4ZM12 20h8v4h-8Z" />
    </svg>
  );
}
