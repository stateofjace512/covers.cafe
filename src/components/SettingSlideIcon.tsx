type Props = { size?: number; className?: string };

export default function SettingSlideIcon({ size = 16, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{ display: 'inline-block', flexShrink: 0 }}
    >
      <g fill="currentColor">
        <path d="m25.905 9.14 0 -3.04 4.57 0 0 -1.53 -4.57 0 0 -3.05 -1.52 0 0 7.62 1.52 0z" />
        <path d="m25.905 30.48 0 -3.05 4.57 0 0 -1.53 -4.57 0 0 -3.04 -1.52 0 0 7.62 1.52 0z" />
        <path d="m30.475 15.24 -21.33 0 0 -3.05 -1.52 0 0 -1.52 -1.53 0 0 1.52 -1.52 0 0 3.05 -3.05 0 0 1.52 3.05 0 0 3.05 1.52 0 0 1.52 1.53 0 0 -1.52 1.52 0 0 -3.05 21.33 0 0 -1.52z" />
        <path d="M22.855 30.48h1.53V32h-1.53Z" />
        <path d="M22.855 21.33h1.53v1.53h-1.53Z" />
        <path d="M22.855 9.14h1.53v1.53h-1.53Z" />
        <path d="M22.855 0h1.53v1.52h-1.53Z" />
        <path d="m22.855 22.86 -1.52 0 0 3.04 -19.81 0 0 1.53 19.81 0 0 3.05 1.52 0 0 -7.62z" />
        <path d="m21.335 4.57 -19.81 0 0 1.53 19.81 0 0 3.04 1.52 0 0 -7.62 -1.52 0 0 3.05z" />
      </g>
    </svg>
  );
}
