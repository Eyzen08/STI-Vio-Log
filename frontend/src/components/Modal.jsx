import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function Modal({ title, subtitle, onClose, children, wide = false, drawer = false, dirty = false, className = '' }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const requestClose = () => dirty ? setConfirmDiscard(true) : onClose()
  const titleId = useId()
  const closeButtonRef = useRef(null)
  const dialogRef = useRef(null)
  const discardFocusRef = useRef(null)
  const onCloseRef = useRef(requestClose)
  onCloseRef.current = requestClose

  useEffect(() => {
    if (confirmDiscard) {
      discardFocusRef.current = document.activeElement
      dialogRef.current?.querySelector('.discard-edits button')?.focus()
    } else {
      discardFocusRef.current?.focus?.()
      discardFocusRef.current = null
    }
  }, [confirmDiscard])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousRootOverflow = document.documentElement.style.overflow
    const previousActiveElement = document.activeElement
    const handleKeyDown = (event) => {
      if (dialogRef.current !== [...document.querySelectorAll('.app-modal')].at(-1)) return
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...(dialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || [])].filter((element) => !element.matches(':disabled') && element.getClientRects().length > 0)
      if (!focusable?.length) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault()
        const target = event.shiftKey ? last : first
        target.focus()
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      document.documentElement.style.overflow = previousRootOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previousActiveElement?.focus?.()
    }
  }, [])

  return createPortal(
    <div className="app-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
      <section ref={dialogRef} tabIndex="-1" onClickCapture={(event) => { if (event.target.closest('[data-modal-dismiss]')) { event.preventDefault(); event.stopPropagation(); requestClose() } }} className={`app-modal${wide ? ' app-modal--wide' : ''}${drawer ? ' app-modal--drawer' : ''}${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="app-modal-header">
          {subtitle ? <div className="app-modal-heading"><h2 id={titleId}>{title}</h2><p>{subtitle}</p></div> : <h2 id={titleId}>{title}</h2>}
          <button ref={closeButtonRef} type="button" className="app-modal-close" onClick={requestClose} aria-label={`Close ${title}`}>×</button>
        </header>
        <div className="app-modal-body"><div hidden={confirmDiscard}>{children}</div>{confirmDiscard && <section className="discard-edits" role="alert"><strong>Discard unsaved changes?</strong><p>Your changes have not been saved.</p><div><button type="button" onClick={() => setConfirmDiscard(false)}>Keep editing</button><button type="button" className="danger-button" onClick={onClose}>Discard changes</button></div></section>}</div>
      </section>
    </div>,
    document.body
  )
}

export default Modal
