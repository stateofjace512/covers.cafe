interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// UserIcon — pixel-art icon, fill inherits currentColor for theme support.
// Original viewBox: 120×118.
export default function UserIcon({ size = 18, className, style }: Props) {
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
        d="M44 15h29v1h-29zM44 16h29v1h-29zM44 17h29v1h-29zM44 18h29v1h-29zM44 19h29v1h-29zM44 20h29v1h-29zM44 21h29v1h-29zM37 22h44v1h-44zM37 23h44v1h-44zM37 24h44v1h-44zM37 25h44v1h-44zM37 26h44v1h-44zM37 27h44v1h-44zM37 28h44v1h-44zM29 29h59v1h-59zM29 30h59v1h-59zM29 31h59v1h-59zM29 32h59v1h-59zM29 33h59v1h-59zM29 34h59v1h-59zM29 35h59v1h-59zM29 36h59v1h-59zM29 37h15v1h-15zM51 37h15v1h-15zM73 37h15v1h-15zM29 38h15v1h-15zM51 38h15v1h-15zM73 38h15v1h-15zM29 39h15v1h-15zM51 39h15v1h-15zM73 39h15v1h-15zM29 40h15v1h-15zM51 40h15v1h-15zM73 40h15v1h-15zM29 41h15v1h-15zM51 41h15v1h-15zM73 41h15v1h-15zM29 42h15v1h-15zM51 42h15v1h-15zM73 42h15v1h-15zM29 43h15v1h-15zM51 43h15v1h-15zM73 43h15v1h-15zM29 44h59v1h-59zM29 45h59v1h-59zM29 46h59v1h-59zM29 47h59v1h-59zM29 48h59v1h-59zM29 49h59v1h-59zM29 50h59v1h-59zM29 51h59v1h-59zM29 52h59v1h-59zM29 53h59v1h-59zM29 54h59v1h-59zM29 55h59v1h-59zM29 56h59v1h-59zM29 57h59v1h-59zM29 58h59v1h-59zM37 59h14v1h-14zM66 59h15v1h-15zM37 60h14v1h-14zM66 60h15v1h-15zM37 61h14v1h-14zM66 61h15v1h-15zM37 62h14v1h-14zM66 62h15v1h-15zM37 63h14v1h-14zM66 63h15v1h-15zM37 64h14v1h-14zM66 64h15v1h-15zM37 65h14v1h-14zM66 65h15v1h-15zM44 66h29v1h-29zM44 67h29v1h-29zM44 68h29v1h-29zM44 69h29v1h-29zM44 70h29v1h-29zM44 71h29v1h-29zM44 72h29v1h-29zM44 73h29v1h-29zM44 81h29v1h-29zM44 82h29v1h-29zM44 83h29v1h-29zM44 84h29v1h-29zM44 85h29v1h-29zM44 86h29v1h-29zM44 87h29v1h-29zM44 88h29v1h-29zM29 89h59v1h-59zM29 90h59v1h-59zM29 91h59v1h-59zM29 92h59v1h-59zM29 93h59v1h-59zM29 94h59v1h-59zM29 95h59v1h-59zM22 96h74v1h-74zM22 97h74v1h-74zM22 98h74v1h-74zM22 99h74v1h-74zM22 100h74v1h-74zM22 101h74v1h-74zM22 102h74v1h-74zM14 103h89v1h-89zM14 104h89v1h-89zM14 105h89v1h-89zM14 106h89v1h-89zM14 107h89v1h-89zM14 108h89v1h-89zM14 109h89v1h-89zM14 110h89v1h-89zM14 111h15v1h-15zM37 111h44v1h-44zM88 111h15v1h-15zM14 112h15v1h-15zM37 112h44v1h-44zM88 112h15v1h-15zM14 113h15v1h-15zM37 113h44v1h-44zM88 113h15v1h-15zM14 114h15v1h-15zM37 114h44v1h-44zM88 114h15v1h-15zM14 115h15v1h-15zM37 115h44v1h-44zM88 115h15v1h-15zM14 116h15v1h-15zM37 116h44v1h-44zM88 116h15v1h-15zM14 117h15v1h-15zM37 117h44v1h-44zM88 117h15v1h-15z"
      />
    </svg>
  );
}
