/**
 * VidhanLogo — renders the actual 3D Vi logo PNG.
 * Save the logo image to: frontend/public/vidhan-logo.png
 * Usage: <VidhanLogo size={36} />
 */
export default function VidhanLogo({ size = 44, className = '' }) {
  return (
    <img
      src="/vidhan-logo.png"
      alt="Vidhan AI"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'cover', display: 'block', borderRadius: '10px' }}
      draggable={false}
    />
  );
}
