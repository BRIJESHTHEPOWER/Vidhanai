/**
 * Magic UI — AuroraText
 * Animates a multi-colour gradient that sweeps continuously across text.
 * Uses background-clip:text + background-position animation.
 */
export function AuroraText({
  children,
  colors = ['#D4A017', '#fbbf24', '#e879f9', '#a78bfa', '#818cf8'],
  speed  = 1,
  className = '',
}) {
  const grad = [...colors, colors[0]].join(', ');
  return (
    <span
      className={`aurora-text${className ? ` ${className}` : ''}`}
      style={{
        backgroundImage: `linear-gradient(120deg, ${grad})`,
        animationDuration: `${(5 / speed).toFixed(2)}s`,
      }}
    >
      {children}
    </span>
  );
}
