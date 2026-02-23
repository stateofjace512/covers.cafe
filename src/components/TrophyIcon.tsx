interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// TrophyIcon — pixel-art icon, fill inherits currentColor for theme support.
// Original viewBox: 120×120.
export default function TrophyIcon({ size = 18, className, style }: Props) {
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
        d="M22 30h11v1h-11zM45 30h5v1h-5zM58 30h3v1h-3zM71 30h4v1h-4zM22 31h11v1h-11zM45 31h3v1h-3zM58 31h3v1h-3zM22 32h11v1h-11zM58 32h3v1h-3zM56 33h7v1h-7zM41 34h4v1h-4zM56 34h7v1h-7zM18 35h4v1h-4zM41 35h4v1h-4zM56 35h7v1h-7zM98 35h3v1h-3zM18 36h4v1h-4zM41 36h4v1h-4zM56 36h7v1h-7zM98 36h3v1h-3zM18 37h4v1h-4zM41 37h4v1h-4zM49 37h22v1h-22zM98 37h3v1h-3zM18 38h4v1h-4zM41 38h4v1h-4zM49 38h22v1h-22zM98 38h3v1h-3zM18 39h4v1h-4zM41 39h4v1h-4zM49 39h22v1h-22zM98 39h3v1h-3zM18 40h4v1h-4zM41 40h4v1h-4zM49 40h22v1h-22zM98 40h3v1h-3zM18 41h4v1h-4zM52 41h15v1h-15zM98 41h3v1h-3zM18 42h4v1h-4zM52 42h15v1h-15zM98 42h3v1h-3zM18 43h4v1h-4zM52 43h15v1h-15zM98 43h3v1h-3zM18 44h4v1h-4zM52 44h15v1h-15zM98 44h3v1h-3zM18 45h4v1h-4zM41 45h4v1h-4zM52 45h15v1h-15zM98 45h3v1h-3zM18 46h4v1h-4zM41 46h4v1h-4zM52 46h15v1h-15zM98 46h3v1h-3zM18 47h4v1h-4zM41 47h4v1h-4zM52 47h15v1h-15zM98 47h3v1h-3zM41 48h4v1h-4zM52 48h4v1h-4zM64 48h3v1h-3zM37 49h11v1h-11zM52 49h4v1h-4zM64 49h3v1h-3zM71 49h11v1h-11zM37 50h11v1h-11zM52 50h4v1h-4zM64 50h3v1h-3zM71 50h11v1h-11zM37 51h11v1h-11zM52 51h4v1h-4zM64 51h3v1h-3zM71 51h11v1h-11zM48 52h4v1h-4zM67 52h4v1h-4zM48 53h4v1h-4zM67 53h4v1h-4zM48 54h4v1h-4zM67 54h4v1h-4zM48 55h4v1h-4zM67 55h4v1h-4zM26 56h4v1h-4zM41 56h7v1h-7zM52 56h4v1h-4zM63 56h4v1h-4zM90 56h4v1h-4zM26 57h4v1h-4zM41 57h7v1h-7zM52 57h4v1h-4zM63 57h4v1h-4zM90 57h4v1h-4zM26 58h4v1h-4zM41 58h7v1h-7zM52 58h4v1h-4zM63 58h4v1h-4zM90 58h4v1h-4zM26 59h4v1h-4zM41 59h7v1h-7zM52 59h4v1h-4zM63 59h4v1h-4zM83 59h3v1h-3zM90 59h4v1h-4zM30 60h11v1h-11zM48 60h8v1h-8zM63 60h8v1h-8zM79 60h11v1h-11zM30 61h11v1h-11zM48 61h8v1h-8zM63 61h8v1h-8zM79 61h11v1h-11zM30 62h11v1h-11zM48 62h8v1h-8zM63 62h8v1h-8zM79 62h11v1h-11zM30 63h11v1h-11zM48 63h8v1h-8zM63 63h8v1h-8zM79 63h11v1h-11zM37 64h8v1h-8zM75 64h7v1h-7zM37 65h8v1h-8zM75 65h7v1h-7zM37 66h8v1h-8zM75 66h7v1h-7zM41 67h4v1h-4zM75 67h3v1h-3zM41 68h7v1h-7zM71 68h7v1h-7zM41 69h7v1h-7zM71 69h7v1h-7zM41 70h7v1h-7zM71 70h7v1h-7zM45 71h3v1h-3zM71 71h4v1h-4zM45 72h7v1h-7zM67 72h8v1h-8zM45 73h7v1h-7zM67 73h8v1h-8zM45 74h7v1h-7zM67 74h8v1h-8zM49 75h22v1h-22zM49 76h22v1h-22zM49 77h22v1h-22zM49 78h22v1h-22zM52 79h4v1h-4zM64 79h3v1h-3zM52 80h4v1h-4zM64 80h3v1h-3zM52 81h4v1h-4zM64 81h3v1h-3zM52 82h4v1h-4zM64 82h3v1h-3zM52 83h4v1h-4zM64 83h3v1h-3zM52 84h4v1h-4zM64 84h3v1h-3zM52 85h4v1h-4zM64 85h3v1h-3zM52 86h4v1h-4zM64 86h3v1h-3zM49 87h7v1h-7zM64 87h7v1h-7zM49 88h7v1h-7zM64 88h7v1h-7zM49 89h7v1h-7zM64 89h7v1h-7zM49 90h3v1h-3zM67 90h4v1h-4zM45 91h7v1h-7zM67 91h8v1h-8zM45 92h7v1h-7zM67 92h8v1h-8zM45 93h7v1h-7zM67 93h8v1h-8zM41 94h38v1h-38zM41 95h38v1h-38zM41 96h38v1h-38zM41 97h38v1h-38zM41 98h3v1h-3zM76 98h3v1h-3zM41 99h3v1h-3zM76 99h3v1h-3zM41 100h3v1h-3zM76 100h3v1h-3zM41 101h3v1h-3zM76 101h3v1h-3zM37 102h4v1h-4zM79 102h3v1h-3zM37 103h4v1h-4zM79 103h3v1h-3zM37 104h4v1h-4zM79 104h3v1h-3zM37 105h4v1h-4zM79 105h3v1h-3zM37 106h45v1h-45zM37 107h45v1h-45zM37 108h45v1h-45z"
      />
    </svg>
  );
}
