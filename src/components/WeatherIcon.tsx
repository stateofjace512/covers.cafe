export default function WeatherIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cloud body */}
      <path
        d="M3 11a3 3 0 0 1 .5-5.95A4 4 0 0 1 11 7a2.5 2.5 0 0 1-.5 4.95"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
      <line x1="3" y1="11" x2="10.5" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      {/* Rain drops */}
      <line x1="5" y1="14" x2="5" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <line x1="11" y1="14" x2="11" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}
