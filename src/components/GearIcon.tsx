interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// GearIcon — pixel-art icon, fill inherits currentColor for theme support.
// Original viewBox: 120×120.
export default function GearIcon({ size = 18, className, style }: Props) {
  const w = Math.round(size * (120 / 120));
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={w}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path
        fill="currentColor"
        d="M52 26h16v1h-16zM52 27h16v1h-16zM52 28h16v1h-16zM37 29h4v1h-4zM52 29h16v1h-16zM79 29h4v1h-4zM37 30h4v1h-4zM52 30h16v1h-16zM79 30h4v1h-4zM37 31h4v1h-4zM52 31h16v1h-16zM79 31h4v1h-4zM37 32h4v1h-4zM52 32h16v1h-16zM79 32h4v1h-4zM33 33h19v1h-19zM68 33h19v1h-19zM33 34h19v1h-19zM68 34h19v1h-19zM33 35h19v1h-19zM68 35h19v1h-19zM33 36h19v1h-19zM68 36h19v1h-19zM29 37h19v1h-19zM72 37h19v1h-19zM29 38h19v1h-19zM72 38h19v1h-19zM29 39h19v1h-19zM72 39h19v1h-19zM29 40h19v1h-19zM72 40h19v1h-19zM33 41h8v1h-8zM52 41h16v1h-16zM79 41h8v1h-8zM33 42h8v1h-8zM52 42h16v1h-16zM79 42h8v1h-8zM33 43h8v1h-8zM52 43h16v1h-16zM79 43h8v1h-8zM33 44h8v1h-8zM52 44h16v1h-16zM79 44h8v1h-8zM33 45h8v1h-8zM48 45h8v1h-8zM64 45h8v1h-8zM79 45h8v1h-8zM33 46h8v1h-8zM48 46h8v1h-8zM64 46h8v1h-8zM79 46h8v1h-8zM33 47h8v1h-8zM48 47h8v1h-8zM64 47h8v1h-8zM79 47h8v1h-8zM33 48h8v1h-8zM48 48h8v1h-8zM64 48h8v1h-8zM79 48h8v1h-8zM33 49h4v1h-4zM45 49h7v1h-7zM68 49h7v1h-7zM83 49h4v1h-4zM33 50h4v1h-4zM45 50h7v1h-7zM68 50h7v1h-7zM83 50h4v1h-4zM33 51h4v1h-4zM45 51h7v1h-7zM68 51h7v1h-7zM83 51h4v1h-4zM26 52h11v1h-11zM41 52h7v1h-7zM72 52h7v1h-7zM83 52h11v1h-11zM26 53h11v1h-11zM41 53h7v1h-7zM72 53h7v1h-7zM83 53h11v1h-11zM26 54h11v1h-11zM41 54h7v1h-7zM72 54h7v1h-7zM83 54h11v1h-11zM26 55h11v1h-11zM41 55h7v1h-7zM72 55h7v1h-7zM83 55h11v1h-11zM26 56h7v1h-7zM41 56h3v1h-3zM76 56h3v1h-3zM87 56h7v1h-7zM26 57h7v1h-7zM41 57h4v1h-4zM75 57h4v1h-4zM87 57h7v1h-7zM26 58h7v1h-7zM41 58h4v1h-4zM75 58h4v1h-4zM87 58h7v1h-7zM26 59h7v1h-7zM41 59h4v1h-4zM75 59h4v1h-4zM87 59h7v1h-7zM26 60h7v1h-7zM41 60h4v1h-4zM75 60h4v1h-4zM87 60h7v1h-7zM26 61h7v1h-7zM41 61h4v1h-4zM75 61h4v1h-4zM87 61h7v1h-7zM26 62h7v1h-7zM41 62h4v1h-4zM75 62h4v1h-4zM87 62h7v1h-7zM26 63h7v1h-7zM87 63h7v1h-7zM26 64h11v1h-11zM41 64h7v1h-7zM72 64h7v1h-7zM83 64h11v1h-11zM26 65h11v1h-11zM41 65h7v1h-7zM72 65h7v1h-7zM83 65h11v1h-11zM26 66h11v1h-11zM41 66h7v1h-7zM72 66h7v1h-7zM83 66h11v1h-11zM26 67h11v1h-11zM41 67h7v1h-7zM72 67h7v1h-7zM83 67h11v1h-11zM33 68h4v1h-4zM45 68h7v1h-7zM68 68h7v1h-7zM83 68h4v1h-4zM33 69h4v1h-4zM45 69h7v1h-7zM68 69h7v1h-7zM83 69h4v1h-4zM33 70h4v1h-4zM45 70h7v1h-7zM68 70h7v1h-7zM83 70h4v1h-4zM33 71h8v1h-8zM48 71h8v1h-8zM64 71h8v1h-8zM79 71h8v1h-8zM33 72h8v1h-8zM48 72h8v1h-8zM64 72h8v1h-8zM79 72h8v1h-8zM33 73h8v1h-8zM48 73h8v1h-8zM64 73h8v1h-8zM79 73h8v1h-8zM33 74h8v1h-8zM48 74h8v1h-8zM64 74h8v1h-8zM79 74h8v1h-8zM33 75h8v1h-8zM52 75h16v1h-16zM79 75h8v1h-8zM33 76h8v1h-8zM52 76h16v1h-16zM79 76h8v1h-8zM33 77h8v1h-8zM52 77h16v1h-16zM79 77h8v1h-8zM33 78h8v1h-8zM52 78h16v1h-16zM79 78h8v1h-8zM29 79h19v1h-19zM72 79h19v1h-19zM29 80h19v1h-19zM72 80h19v1h-19zM29 81h19v1h-19zM72 81h19v1h-19zM29 82h19v1h-19zM72 82h19v1h-19zM33 83h19v1h-19zM68 83h19v1h-19zM33 84h19v1h-19zM68 84h19v1h-19zM33 85h19v1h-19zM68 85h19v1h-19zM33 86h19v1h-19zM68 86h19v1h-19zM37 87h4v1h-4zM52 87h16v1h-16zM79 87h4v1h-4zM37 88h4v1h-4zM52 88h16v1h-16zM79 88h4v1h-4zM37 89h4v1h-4zM52 89h16v1h-16zM79 89h4v1h-4zM37 90h4v1h-4zM52 90h16v1h-16zM79 90h4v1h-4zM52 91h16v1h-16zM52 92h16v1h-16zM52 93h16v1h-16z"
      />
    </svg>
  );
}
