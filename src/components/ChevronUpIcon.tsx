interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function ChevronUpIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M12 8h8v4h-8ZM8 12h4v4H8ZM20 12h4v4h-4ZM4 16h4v4H4ZM24 16h4v4h-4ZM0 20h4v4H0ZM28 20h4v4h-4Z" />
    </svg>
  );
}
