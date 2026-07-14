import './BorderBeam.css';

/**
 * Magic UI — BorderBeam
 * An animated beam of light that travels around the border of its container.
 *
 * Requires the parent to have:
 *   position: relative; overflow: hidden; border-radius: <any>;
 *
 * Uses CSS @property (Houdini) to animate --border-angle inside a
 * conic-gradient. Supported: Chrome 85+, Firefox 128+, Safari 16.4+.
 * Falls back to a static gradient border on older browsers.
 */
export function BorderBeam({
  colorFrom   = '#D4A017',
  colorTo     = '#818cf8',
  duration    = 6,
  delay       = 0,
  borderWidth = 1.5,
  size        = 200,
  className   = '',
}) {
  return (
    <span
      className={`border-beam${className ? ` ${className}` : ''}`}
      style={{
        '--beam-from'  : colorFrom,
        '--beam-to'    : colorTo,
        '--beam-dur'   : `${duration}s`,
        '--beam-delay' : `${delay}s`,
        '--beam-w'     : `${borderWidth}px`,
        '--beam-size'  : `${size}px`,
      }}
      aria-hidden="true"
    />
  );
}
