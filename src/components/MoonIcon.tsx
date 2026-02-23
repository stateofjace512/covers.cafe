interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// MoonIcon — pixel-art icon, fill inherits currentColor for theme support.
// Original viewBox: 120×118.
export default function MoonIcon({ size = 18, className, style }: Props) {
  const w = Math.round(size * (120 / 118));
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
      <path fill="currentColor" d="M52 10h23v1H52zm0 1h23v1H52zm0 1h23v1H52zm0 1h23v1H52zm-41 1h4v1h-4zm34 0h41v1H45zm-34 1h4v1h-4zm34 0h41v1H45zm-34 1h4v1h-4zm34 0h41v1H45zm-34 1h4v1h-4zm34 0h41v1H45zm-30 1h4v1h-4zm22 0h34v1H37zm49 0h7v1h-7zm-71 1h4v1h-4zm22 0h34v1H37zm49 0h7v1h-7zm-71 1h4v1h-4zm22 0h34v1H37zm49 0h7v1h-7zm-71 1h4v1h-4zm22 0h34v1H37zm49 0h7v1h-7zm-52 1h29v1H34zm59 0h4v1h-4zm-59 1h29v1H34zm59 0h4v1h-4zm-59 1h29v1H34zm59 0h4v1h-4zm-63 1h30v1H30zm0 1h30v1H30zm0 1h30v1H30zm0 1h30v1H30zm-4 1h30v1H26zm0 1h30v1H26zm0 1h30v1H26zm0 1h30v1H26zm0 1h26v1H26zm45 0h4v1h-4zm-45 1h26v1H26zm45 0h4v1h-4zm-45 1h26v1H26zm45 0h4v1h-4zm-45 1h26v1H26zm45 0h4v1h-4zm-48 1h26v1H23zm78 0h3v1h-3zm-78 1h26v1H23zm78 0h3v1h-3zm-78 1h26v1H23zm78 0h3v1h-3zm-78 1h26v1H23zm81 0h4v1h-4zm-81 1h26v1H23zm81 0h4v1h-4zm-81 1h26v1H23zm81 0h4v1h-4zm-81 1h26v1H23zm81 0h4v1h-4zm-81 1h22v1H23zm0 1h22v1H23zm0 1h22v1H23zm0 1h22v1H23zm-4 1h26v1H19zm0 1h26v1H19zm0 1h26v1H19zm0 1h26v1H19zm0 1h26v1H19zm44 0h4v1h-4zm-44 1h26v1H19zm44 0h4v1h-4zm-44 1h26v1H19zm44 0h4v1h-4zm-44 1h26v1H19zm0 1h26v1H19zm0 1h26v1H19zm0 1h26v1H19zm0 1h26v1H19zm0 1h26v1H19zm0 1h26v1H19zm0 1h26v1H19zm0 1h26v1H19zm74 0h4v1h-4zm-74 1h26v1H19zm74 0h4v1h-4zm-74 1h26v1H19zm74 0h4v1h-4zm-74 1h30v1H19zm71 0h3v1h-3zm-71 1h30v1H19zm71 0h3v1h-3zm-71 1h30v1H19zm71 0h3v1h-3zm-71 1h30v1H19zm71 0h3v1h-3zm-67 1h26v1H23zm0 1h26v1H23zm0 1h26v1H23zm0 1h26v1H23zm0 1h29v1H23zm0 1h29v1H23zm0 1h29v1H23zm0 1h29v1H23zm-12 1h4v1h-4zm12 0h33v1H23zm-12 1h4v1h-4zm12 0h33v1H23zm-12 1h4v1h-4zm12 0h33v1H23zm3 1h34v1H26zm71 0h4v1h-4zm-71 1h34v1H26zm71 0h4v1h-4zm-71 1h34v1H26zm71 0h4v1h-4zm-71 1h34v1H26zm71 0h4v1h-4zm-67 1h37v1H30zm63 0h4v1h-4zm-63 1h37v1H30zm63 0h4v1h-4zm-63 1h37v1H30zm63 0h4v1h-4zm-63 1h37v1H30zm63 0h4v1h-4zm-59 1h41v1H34zm52 0h7v1h-7zm-52 1h41v1H34zm52 0h7v1h-7zm-52 1h41v1H34zm52 0h7v1h-7zm-52 1h41v1H34zm52 0h7v1h-7zm-49 1h52v1H37zm0 1h52v1H37zm0 1h52v1H37zm8 1h37v1H45zm0 1h37v1H45zm0 1h37v1H45zm0 1h37v1H45zm-30 1h4v1h-4zm37 0h23v1H52zm-37 1h4v1h-4zm37 0h23v1H52zm-37 1h4v1h-4zm37 0h23v1H52zm-37 1h4v1h-4zm37 0h23v1H52zm49 1h3v1h-3zm0 1h3v1h-3zm0 1h3v1h-3zm0 1h3v1h-3z"/>
    </svg>
  );
}
