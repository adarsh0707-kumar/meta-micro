// Big-hearted, chunky flat-illustration character for the landing hero —
// a warm, welcoming teacher figure in the meta-micro palette.
export default function Character({ className = "" }) {
  return (
    <svg
      viewBox="0 0 480 480"
      className={className}
      role="img"
      aria-label="Illustration of a smiling teacher holding a book and waving"
    >
      <circle cx="240" cy="240" r="220" fill="#FFD700" opacity="0.18" />
      <circle cx="240" cy="410" r="140" fill="#333333" opacity="0.06" />

      {/* body */}
      <path
        d="M140 460c0-90 45-150 100-150s100 60 100 150"
        fill="#FF6F61"
      />
      <rect x="180" y="270" width="120" height="90" rx="30" fill="#FF6F61" />

      {/* head */}
      <circle cx="240" cy="200" r="90" fill="#FFE0B2" />

      {/* hair */}
      <path
        d="M150 190c0-60 40-100 90-100s90 40 90 100c-20-20-50-30-90-30s-70 10-90 30z"
        fill="#333333"
      />

      {/* eyes */}
      <circle cx="205" cy="205" r="9" fill="#333333" />
      <circle cx="275" cy="205" r="9" fill="#333333" />

      {/* smile */}
      <path
        d="M200 235c15 20 65 20 80 0"
        stroke="#333333"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />

      {/* cheeks */}
      <circle cx="185" cy="225" r="12" fill="#FF6F61" opacity="0.35" />
      <circle cx="295" cy="225" r="12" fill="#FF6F61" opacity="0.35" />

      {/* waving arm */}
      <path
        d="M300 300c40-10 60-50 55-90"
        stroke="#FFE0B2"
        strokeWidth="34"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="358" cy="205" r="22" fill="#FFE0B2" />

      {/* book */}
      <g transform="translate(130 330)">
        <rect x="0" y="0" width="110" height="75" rx="10" fill="#FFFFFF" />
        <rect x="0" y="0" width="110" height="75" rx="10" fill="none" stroke="#333333" strokeWidth="4" />
        <line x1="55" y1="6" x2="55" y2="69" stroke="#FFD700" strokeWidth="6" />
        <line x1="14" y1="20" x2="42" y2="20" stroke="#333333" strokeWidth="4" strokeLinecap="round" />
        <line x1="14" y1="34" x2="42" y2="34" stroke="#333333" strokeWidth="4" strokeLinecap="round" />
        <line x1="68" y1="20" x2="96" y2="20" stroke="#333333" strokeWidth="4" strokeLinecap="round" />
        <line x1="68" y1="34" x2="96" y2="34" stroke="#333333" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}
