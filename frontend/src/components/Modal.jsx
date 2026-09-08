import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function Modal({ title, onClose, children, wide = false, drawer = false, dirty = false }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const requestClose = () => dirty ? setConfirmDiscard(true) : onClose()
  const titleId = useId()
  const closeButtonRef = useRef(null)
  const dialogRef = useRef(null)
  const onCloseRef = useRef(requestClose)
  onCloseRef.current = requestClose

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousActiveElement = document.activeElement
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable?.length) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previousActiveElement?.focus?.()
    }
  }, [])

  return createPortal(
    <div className="app-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
      <section ref={dialogRef} tabIndex="-1" onClickCapture={(event) => { if (event.target.closest('[data-modal-dismiss]')) { event.preventDefault(); event.stopPropagation(); requestClose() } }} className={`app-modal${wide ? ' app-modal--wide' : ''}${drawer ? ' app-modal--drawer' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="app-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeButtonRef} type="button" className="app-modal-close" onClick={requestClose} aria-label={`Close ${title}`}>×</button>
        </header>
        <div className="app-modal-body">{confirmDiscard ? <section className="discard-edits" role="alert"><strong>Discard unsaved changes?</strong><p>Your changes have not been saved.</p><div><button type="button" onClick={() => setConfirmDiscard(false)}>Keep editing</button><button type="button" className="danger-button" onClick={onClose}>Discard changes</button></div></section> : children}</div>
      </section>
    </div>,
    document.body
  )
}

export default Modal
