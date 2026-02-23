interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}
// UploadDownloadIcon — pixel-art icon, fill inherits currentColor for theme support.
// Original viewBox: 120×118.
export default function UploadDownloadIcon({ size = 18, className, style }: Props) {
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
      <path
        fill="currentColor"
        d="M56 14h7v1h-7zM56 15h7v1h-7zM56 16h7v1h-7zM56 17h7v1h-7zM52 18h15v1h-15zM52 19h15v1h-15zM52 20h15v1h-15zM52 21h15v1h-15zM49 22h22v1h-22zM49 23h22v1h-22zM49 24h22v1h-22zM45 25h30v1h-30zM45 26h30v1h-30zM45 27h30v1h-30zM45 28h30v1h-30zM41 29h37v1h-37zM41 30h37v1h-37zM41 31h37v1h-37zM41 32h37v1h-37zM37 33h45v1h-45zM37 34h45v1h-45zM37 35h45v1h-45zM34 36h50v1h-50zM84 36h2v1h-2zM34 37h52v1h-52zM34 38h52v1h-52zM34 39h52v1h-52zM30 40h59v1h-59zM30 41h59v1h-59zM30 42h59v1h-59zM30 43h59v1h-59zM26 44h67v1h-67zM26 45h67v1h-67zM26 46h67v1h-67zM26 47h64v1h-64zM90 47h3v1h-3zM49 48h22v1h-22zM49 49h22v1h-22zM49 50h22v1h-22zM49 51h22v1h-22zM49 52h22v1h-22zM49 53h22v1h-22zM49 54h22v1h-22zM49 55h22v1h-22zM49 56h22v1h-22zM49 57h22v1h-22zM49 58h22v1h-22zM49 59h22v1h-22zM49 60h22v1h-22zM49 61h22v1h-22zM49 62h22v1h-22zM49 63h22v1h-22zM49 64h22v1h-22zM49 65h22v1h-22zM49 66h22v1h-22zM49 67h22v1h-22zM49 68h22v1h-22zM49 69h22v1h-22zM49 70h22v1h-22zM49 71h22v1h-22zM49 72h22v1h-22zM49 73h22v1h-22zM49 74h22v1h-22zM49 75h22v1h-22zM49 76h22v1h-22zM49 77h22v1h-22zM49 78h22v1h-22zM49 79h22v1h-22zM49 80h22v1h-22zM49 81h22v1h-22zM49 82h22v1h-22zM49 83h22v1h-22zM49 84h22v1h-22zM49 85h22v1h-22zM49 86h22v1h-22zM49 87h22v1h-22zM49 88h22v1h-22zM49 89h22v1h-22zM49 90h22v1h-22zM49 91h22v1h-22zM49 92h22v1h-22zM49 93h22v1h-22zM49 94h22v1h-22zM49 95h22v1h-22zM49 96h22v1h-22zM49 97h22v1h-22zM49 98h22v1h-22zM49 99h22v1h-22z"
      />
    </svg>
  );
}
