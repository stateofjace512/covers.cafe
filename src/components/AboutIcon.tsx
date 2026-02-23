interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// AboutIcon — pixel-art icon, fill inherits currentColor for theme support.
// Original viewBox: 120×120.
export default function AboutIcon({ size = 18, className, style }: Props) {
  const w = Math.round(size * (120 / 120));
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={w}
      height={size}
      viewBox="0 0 120 118"
      aria-hidden="true"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
    <path fill="currentColor" d="M57 26h7v1h-7zm0 1h7v1h-7zm0 1h7v1h-7zm0 1h7v1h-7zm-11 1h30v1H46zm0 1h30v1H46zm0 1h30v1H46zm-19 1h22v1H27zm45 0h23v1H72zm-45 1h22v1H27zm45 0h23v1H72zm-45 1h22v1H27zm45 0h23v1H72zm-45 1h22v1H27zm45 0h23v1H72zm-45 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm31-4h5v22h-5zm29 4h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-60 1h7v1h-7zm60 0h8v1h-8zm-57 1h8v1h-8zm53 0h8v1h-8zm-53 1h8v1h-8zm53 0h8v1h-8zm-53 1h8v1h-8zm53 0h8v1h-8zm-53 1h8v1h-8zm53 0h8v1h-8zm-53 1h8v1h-8zm53 0h8v1h-8zm-53 1h8v1h-8zm53 0h8v1h-8zm-53 1h8v1h-8zm53 0h8v1h-8zm-53 1h8v1h-8zm53 0h8v1h-8zm-53 1h8v1h-8zm53 0h8v1h-8zm-53 1h8v1h-8zm53 0h8v1h-8zm-53 1h8v1h-8zm53 0h8v1h-8zm-49 1h8v1h-8zm46 0h7v1h-7zm-46 1h8v1h-8zm46 0h7v1h-7zm-46 1h8v1h-8zm46 0h7v1h-7zm-46 1h8v1h-8zm46 0h7v1h-7zm-4 1h7v1h-7zm-38 0h8v4h-8zm38 1h7v1h-7zm0 1h7v1h-7zm0 1h7v1h-7zm-34 1h7v1h-7zm11-9h15v3H53zm19 9h8v1h-8zm-30 1h7v1h-7zm30 0h8v1h-8zm-30 1h7v1h-7zm30 0h8v1h-8zm-26 1h11v4H46z"/>
      <path fill="currentColor" d="M46 93h30v1H46zm3 1h23v1H49zm0 1h23v1H49zm0 1h23v1H49zm0 1h23v1H49z"/>
      <path fill="currentColor" d="M54 96h11v4H54zm11-6h11v4H65zM53 54h10v3H53zm5-8h5v5h-5z"/>
    </svg>
  );
}
