const searchableText = (input) => [input.id, input.getAttribute('aria-label'), input.getAttribute('placeholder')]
  .filter(Boolean).join(' ').toLowerCase()

export const isPortalSearchInput = (input) => input?.tagName === 'INPUT' && (
  input.type === 'search' || /\b(search|find)\b/.test(searchableText(input))
)

const searchName = (input) => {
  const source = input.id || input.getAttribute('aria-label') || input.getAttribute('placeholder') || 'portal-search'
  return `portal-${source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

export const prepareSearchInput = (input) => {
  if (!isPortalSearchInput(input)) return false
  input.setAttribute('autocomplete', 'off')
  if (!input.name) input.name = searchName(input)
  return true
}

export const installSearchInputGuard = (documentRef = globalThis.document) => {
  if (!documentRef?.documentElement) return () => {}
  const prepareTree = (root) => {
    if (root?.tagName === 'INPUT') prepareSearchInput(root)
    root?.querySelectorAll?.('input').forEach(prepareSearchInput)
  }
  prepareTree(documentRef)
  const Observer = documentRef.defaultView?.MutationObserver || globalThis.MutationObserver
  if (!Observer) return () => {}
  const observer = new Observer((records) => records.forEach((record) => record.addedNodes.forEach(prepareTree)))
  observer.observe(documentRef.documentElement, { childList: true, subtree: true })
  return () => observer.disconnect()
}
