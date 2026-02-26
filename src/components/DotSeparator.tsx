/** Inline separator — a tiny square that replaces the cheap "·" character. */
export default function DotSeparator() {
  return (
    <svg
      className="dot-sep"
      width="4"
      height="4"
      viewBox="0 0 4 4"
      aria-hidden="true"
      focusable={false}
    >
      <rect width="4" height="4" rx="0.5" />
    </svg>
  );
}
