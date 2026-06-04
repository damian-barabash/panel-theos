// The Theos wordmark logo (pixel-art). Lives in /public so the relative
// './Logo.png' URL resolves under any GH Pages subpath.
export function Logo({ className = '', height = 56 }) {
  return (
    <img
      src="./Logo.png"
      alt="Theos"
      height={height}
      // width:auto + self-start keep the aspect ratio when the logo is a flex
      // child (e.g. the mobile drawer column), where align-items:stretch would
      // otherwise stretch it horizontally.
      style={{ height, width: 'auto', imageRendering: 'pixelated' }}
      className={`block w-auto self-start shrink-0 ${className}`}
      draggable={false}
    />
  )
}
