interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// ShieldIcon — pixel-art icon, fill inherits currentColor for theme support.
// Original viewBox: 120×120.
export default function ShieldIcon({ size = 18, className, style }: Props) {
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
        d="M57 26h7v1h-7zM57 27h7v1h-7zM57 28h7v1h-7zM57 29h7v1h-7zM46 30h30v1h-30zM46 31h30v1h-30zM46 32h30v1h-30zM27 33h22v1h-22zM57 33h7v1h-7zM72 33h23v1h-23zM27 34h22v1h-22zM57 34h7v1h-7zM72 34h23v1h-23zM27 35h22v1h-22zM57 35h7v1h-7zM72 35h23v1h-23zM27 36h22v1h-22zM57 36h7v1h-7zM72 36h23v1h-23zM27 37h7v1h-7zM57 37h7v1h-7zM87 37h8v1h-8zM27 38h7v1h-7zM57 38h7v1h-7zM87 38h8v1h-8zM27 39h7v1h-7zM57 39h7v1h-7zM87 39h8v1h-8zM27 40h7v1h-7zM57 40h7v1h-7zM87 40h8v1h-8zM27 41h7v1h-7zM38 41h8v1h-8zM57 41h7v1h-7zM76 41h7v1h-7zM87 41h8v1h-8zM27 42h7v1h-7zM38 42h8v1h-8zM57 42h7v1h-7zM76 42h7v1h-7zM87 42h8v1h-8zM27 43h7v1h-7zM38 43h8v1h-8zM57 43h7v1h-7zM76 43h7v1h-7zM87 43h8v1h-8zM27 44h7v1h-7zM38 44h8v1h-8zM57 44h7v1h-7zM76 44h7v1h-7zM87 44h8v1h-8zM27 45h7v1h-7zM38 45h11v1h-11zM57 45h7v1h-7zM72 45h11v1h-11zM87 45h8v1h-8zM27 46h7v1h-7zM38 46h11v1h-11zM57 46h7v1h-7zM72 46h11v1h-11zM87 46h8v1h-8zM27 47h7v1h-7zM38 47h11v1h-11zM57 47h7v1h-7zM72 47h11v1h-11zM87 47h8v1h-8zM27 48h7v1h-7zM38 48h11v1h-11zM57 48h7v1h-7zM72 48h11v1h-11zM87 48h8v1h-8zM27 49h7v1h-7zM42 49h11v1h-11zM57 49h7v1h-7zM68 49h12v1h-12zM87 49h8v1h-8zM27 50h7v1h-7zM42 50h11v1h-11zM57 50h7v1h-7zM68 50h12v1h-12zM87 50h8v1h-8zM27 51h7v1h-7zM42 51h11v1h-11zM57 51h7v1h-7zM68 51h12v1h-12zM87 51h8v1h-8zM27 52h7v1h-7zM46 52h30v1h-30zM87 52h8v1h-8zM27 53h7v1h-7zM46 53h30v1h-30zM87 53h8v1h-8zM27 54h7v1h-7zM46 54h30v1h-30zM87 54h8v1h-8zM27 55h7v1h-7zM46 55h30v1h-30zM87 55h8v1h-8zM27 56h7v1h-7zM49 56h23v1h-23zM87 56h8v1h-8zM27 57h7v1h-7zM49 57h23v1h-23zM87 57h8v1h-8zM27 58h7v1h-7zM49 58h23v1h-23zM87 58h8v1h-8zM27 59h7v1h-7zM49 59h23v1h-23zM87 59h8v1h-8zM27 60h7v1h-7zM53 60h15v1h-15zM87 60h8v1h-8zM27 61h7v1h-7zM53 61h15v1h-15zM87 61h8v1h-8zM27 62h7v1h-7zM53 62h15v1h-15zM87 62h8v1h-8zM27 63h7v1h-7zM53 63h15v1h-15zM87 63h8v1h-8zM27 64h7v1h-7zM46 64h3v1h-3zM57 64h7v1h-7zM72 64h4v1h-4zM87 64h8v1h-8zM27 65h7v1h-7zM46 65h3v1h-3zM57 65h7v1h-7zM72 65h4v1h-4zM87 65h8v1h-8zM27 66h7v1h-7zM46 66h3v1h-3zM57 66h7v1h-7zM72 66h4v1h-4zM87 66h8v1h-8zM27 67h7v1h-7zM46 67h3v1h-3zM57 67h7v1h-7zM72 67h4v1h-4zM87 67h8v1h-8zM30 68h8v1h-8zM42 68h11v1h-11zM57 68h7v1h-7zM68 68h12v1h-12zM83 68h8v1h-8zM30 69h8v1h-8zM42 69h11v1h-11zM57 69h7v1h-7zM68 69h12v1h-12zM83 69h8v1h-8zM30 70h8v1h-8zM42 70h11v1h-11zM57 70h7v1h-7zM68 70h12v1h-12zM83 70h8v1h-8zM30 71h8v1h-8zM42 71h4v1h-4zM57 71h7v1h-7zM76 71h4v1h-4zM83 71h8v1h-8zM30 72h8v1h-8zM42 72h4v1h-4zM57 72h7v1h-7zM76 72h4v1h-4zM83 72h8v1h-8zM30 73h8v1h-8zM42 73h4v1h-4zM57 73h7v1h-7zM76 73h4v1h-4zM83 73h8v1h-8zM30 74h8v1h-8zM42 74h4v1h-4zM57 74h7v1h-7zM76 74h4v1h-4zM83 74h8v1h-8zM30 75h8v1h-8zM57 75h7v1h-7zM83 75h8v1h-8zM30 76h8v1h-8zM57 76h7v1h-7zM83 76h8v1h-8zM30 77h8v1h-8zM57 77h7v1h-7zM83 77h8v1h-8zM30 78h8v1h-8zM57 78h7v1h-7zM83 78h8v1h-8zM34 79h8v1h-8zM57 79h7v1h-7zM80 79h7v1h-7zM34 80h8v1h-8zM57 80h7v1h-7zM80 80h7v1h-7zM34 81h8v1h-8zM57 81h7v1h-7zM80 81h7v1h-7zM34 82h8v1h-8zM57 82h7v1h-7zM80 82h7v1h-7zM38 83h8v1h-8zM57 83h7v1h-7zM76 83h7v1h-7zM38 84h8v1h-8zM57 84h7v1h-7zM76 84h7v1h-7zM38 85h8v1h-8zM57 85h7v1h-7zM76 85h7v1h-7zM38 86h8v1h-8zM57 86h7v1h-7zM76 86h7v1h-7zM42 87h7v1h-7zM57 87h7v1h-7zM72 87h8v1h-8zM42 88h7v1h-7zM57 88h7v1h-7zM72 88h8v1h-8zM42 89h7v1h-7zM57 89h7v1h-7zM72 89h8v1h-8zM46 90h30v1h-30zM46 91h30v1h-30zM46 92h30v1h-30zM46 93h30v1h-30zM49 94h23v1h-23zM49 95h23v1h-23zM49 96h23v1h-23zM49 97h23v1h-23z"
      />
    </svg>
  );
}
