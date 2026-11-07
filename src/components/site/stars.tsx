/** Hang sao kieu Amazon (#FFA41C), ho tro nua sao. */
export function Stars({ rating, size = 16, className = "" }: { rating: number; size?: number; className?: string }) {
  const r = Math.max(0, Math.min(5, rating));
  return (
    <span className={`inline-flex items-center ${className}`} role="img" aria-label={`${r.toFixed(1)} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, r - i));
        const pct = fill >= 0.75 ? 100 : fill >= 0.25 ? 50 : 0;
        return <Star key={i} pct={pct} size={size} />;
      })}
    </span>
  );
}

function Star({ pct, size }: { pct: number; size: number }) {
  const path = "M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L10 15l-5.4 3 1.2-6L1.3 7.8l6.1-.7z";
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
      <path d={path} fill="#fff" stroke="#de7921" strokeWidth="1" />
      {pct > 0 && (
        <path
          d={path}
          fill="#ffa41c"
          stroke="#de7921"
          strokeWidth="1"
          style={pct < 100 ? { clipPath: "inset(0 50% 0 0)" } : undefined}
        />
      )}
    </svg>
  );
}
