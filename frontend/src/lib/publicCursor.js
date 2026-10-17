export function installPublicCursor(root) {
  let selecting = false
  const removals = []
  const listen = (element, name, handler) => {
    element.addEventListener(name, handler)
    removals.push(() => element.removeEventListener(name, handler))
  }
  const hide = () => root.removeAttribute('data-cursor')
  const update = event => {
    if (event.pointerType !== 'mouse' || selecting || document.getSelection()?.toString() || event.target.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')) hide()
    else if (root.dataset.cursor !== 'active') root.dataset.cursor = 'active'
  }
  for (const event of ['pointermove', 'pointerover', 'pointerdown']) listen(root, event, update)
  listen(window, 'pointerup', () => { selecting = false })
  listen(root, 'selectstart', () => { selecting = true; hide() })
  listen(document, 'selectionchange', () => { if (document.getSelection()?.toString()) hide() })
  listen(root, 'pointerleave', hide)
  listen(window, 'blur', hide)
  listen(document, 'keydown', hide)
  listen(document, 'visibilitychange', () => { if (document.hidden) hide() })
  return () => { removals.forEach(remove => remove()); hide() }
}
