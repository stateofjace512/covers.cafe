interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function CastleIcon({ size = 18, className, style }: Props) {
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
      <path fill="currentColor" d="M30.48 8.385H32v3.04h-1.52Z" />
      <path fill="currentColor" d="M27.43 14.475h1.52v6.1H18.29V22.1h1.52v1.52h-1.52v1.53h10.66v3.05h1.53V11.425h-3.05Zm-4.57 9.14h-1.53V22.1h1.53Zm6.09 0H25.9V22.1h3.05Z" />
      <path fill="currentColor" d="m28.95 9.905 0 -1.52 1.53 0 0 -1.53 -3.05 0 0 1.53 -1.53 0 0 3.04 1.53 0 0 -1.52 1.52 0z" />
      <path fill="currentColor" d="m16.76 28.195 0 -1.53 -1.52 0 0 1.53 -12.19 0 0 1.52 25.9 0 0 -1.52 -12.19 0z" />
      <path fill="currentColor" d="m21.33 15.995 0 1.53 1.53 0 0 1.52 1.52 0 0 -1.52 1.52 0 0 -1.53 1.53 0 0 -1.52 -1.53 0 0 -1.52 -1.52 0 0 -1.53 -1.52 0 0 1.53 -1.53 0 0 1.52 -1.52 0 0 1.52 1.52 0z" />
      <path fill="currentColor" d="M18.29 12.955h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M18.29 3.805h1.52v4.58h-1.52Z" />
      <path fill="currentColor" d="M16.76 25.145h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M16.76 19.045h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M16.76 11.425h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M15.24 22.095h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M15.24 17.525h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="m16.76 9.905 1.53 0 0 -1.52 -4.58 0 0 1.52 1.53 0 0 1.52 1.52 0 0 -1.52z" />
      <path fill="currentColor" d="M15.24 5.335h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M13.71 2.285h4.58v1.52h-4.58Z" />
      <path fill="currentColor" d="M13.71 25.145h1.53v1.52h-1.53Z" />
      <path fill="currentColor" d="M13.71 19.045h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M13.71 11.425h1.53v1.53h-1.53Z" />
      <path fill="currentColor" d="M12.19 12.955h1.52v1.52h-1.52Z" />
      <path fill="currentColor" d="M12.19 3.805h1.52v4.58h-1.52Z" />
      <path fill="currentColor" d="m6.1 15.995 0 1.53 1.52 0 0 1.52 1.52 0 0 -1.52 1.53 0 0 -1.53 1.52 0 0 -1.52 -1.52 0 0 -1.52 -1.53 0 0 -1.53 -1.52 0 0 1.53 -1.52 0 0 1.52 -1.53 0 0 1.52 1.53 0z" />
      <path fill="currentColor" d="m3.05 9.905 1.52 0 0 1.52 1.53 0 0 -3.04 -1.53 0 0 -1.53 -3.05 0 0 1.53 1.53 0 0 1.52z" />
      <path fill="currentColor" d="M13.71 25.145v-1.53h-1.52V22.1h1.52v-1.52H3.05v-6.1h1.52v-3.05H1.52V28.2h1.53v-3.05ZM9.14 22.1h1.53v1.52H9.14Zm-6.09 0H6.1v1.52H3.05Z" />
      <path fill="currentColor" d="M0 8.385h1.52v3.04H0Z" />
    </svg>
  );
}
