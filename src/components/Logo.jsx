// The Theos wordmark logo (pixel-art). Lives in /public so the relative
// './Logo.png' URL resolves under any GH Pages subpath.
export function Logo({ className = '', height = 56 }) {
  return (
    <img
      src="./Logo.png"
      alt="Theos"
      height={height}
      style={{ height, imageRendering: 'pixelated' }}
      className={className}
      draggable={false}
    />
  )
}
