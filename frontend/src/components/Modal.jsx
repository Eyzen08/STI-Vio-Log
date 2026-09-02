import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

function Modal({ title, onClose, children, wide = false }) {
  const titleId = useId()
  const closeButtonRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return createPortal(
    <div className="app-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`app-modal${wide ? ' app-modal--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="app-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeButtonRef} type="button" className="app-modal-close" onClick={onClose} aria-label={`Close ${title}`}>×</button>
        </header>
        <div className="app-modal-body">{children}</div>
      </section>
    </div>,
    document.body
  )
}

export default Modal
