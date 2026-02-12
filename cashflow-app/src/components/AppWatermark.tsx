export default function AppWatermark() {
  return (
    <div className="app-watermark" aria-hidden="true">
      <svg
        viewBox="0 0 220 48"
        xmlns="http://www.w3.org/2000/svg"
        role="presentation"
        focusable="false"
      >
        <rect
          x="2"
          y="2"
          width="44"
          height="44"
          rx="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M14 12L24 32L34 12"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="square"
        />
        <path
          d="M4 4h40"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />
        <text
          x="58"
          y="32"
          fill="currentColor"
          fontFamily="var(--font-playfair), Georgia, serif"
          fontSize="24"
          fontWeight="700"
          letterSpacing="-0.02em"
        >
          Velanovo
        </text>
      </svg>
    </div>
  );
}
