/**
 * Magic UI — ShinyBadge
 * Pill badge where the label text has a bright shimmer sweep animation,
 * identical to AnimatedShinyText from magicui.design.
 * Colours adapt via [data-theme] CSS custom properties.
 */
export function ShinyBadge({ children, icon, shimmerWidth = 90, className = '' }) {
  return (
    <div className={`shiny-badge${className ? ` ${className}` : ''}`}>
      <span className="shiny-badge-dot" aria-hidden="true" />
      {icon && <span className="shiny-badge-icon" aria-hidden="true">{icon}</span>}
      <span
        className="shiny-badge-text"
        style={{ '--shimmer-w': `${shimmerWidth}px` }}
      >
        {children}
      </span>
    </div>
  );
}
