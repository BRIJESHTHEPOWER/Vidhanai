/**
 * VidhanLogo — renders the actual 3D Vi logo PNG.
 * Save the logo image to: frontend/public/vidhan-logo.png
 * Usage: <VidhanLogo size={36} />
 */
export default function VidhanLogo({ size = 36, className = '' }) {
  return (
    <img
      src="/vidhan-logo.png"
      alt="Vidhan AI"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', display: 'block' }}
      draggable={false}
    />
  );
}
