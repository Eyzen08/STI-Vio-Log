import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PortalIcon from './PortalIcon.jsx'

export default function StudentDirectorySelect({ label, value, options, onChange, disabled = false }) {
  const id = useId()
  const triggerRef = useRef(null)
  const popupRef = useRef(null)
  const anchorRef = useRef(null)
  const typedRef = useRef({ text: '', time: 0 })
  const [position, setPosition] = useState(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const selectedIndex = options.findIndex((option) => option.value === value)
  const active = Math.min(activeIndex, options.length - 1)
  const open = Boolean(position) && !disabled

  const close = () => {
    setPosition(null)
    typedRef.current = { text: '', time: 0 }
  }
  const commit = () => {
    if (options[active]) onChange(options[active].value)
    close()
  }
  const show = (index = Math.max(0, selectedIndex)) => {
    if (disabled || !options.length) return
    const rect = triggerRef.current.getBoundingClientRect()
    anchorRef.current = rect
    const desiredHeight = Math.min(288, options.length * 44 + 12 + (options.some((option) => option.section) ? 32 : 0))
    const below = Math.max(0, window.innerHeight - rect.bottom - 14)
    const above = Math.max(0, rect.top - 14)
    const upward = below < desiredHeight && above > below
    const width = Math.min(rect.width, window.innerWidth - 16)
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width,
      maxHeight: Math.min(desiredHeight, upward ? above : below),
      ...(upward ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 })
    })
    setActiveIndex(index)
    typedRef.current = { text: '', time: 0 }
  }

  useEffect(() => {
    if (!open) return undefined
    const outside = (event) => {
      if (!triggerRef.current?.contains(event.target) && !popupRef.current?.contains(event.target)) close()
    }
    const scroll = (event) => {
      if (popupRef.current?.contains(event.target)) return
      const rect = triggerRef.current?.getBoundingClientRect()
      const ancestor = event.target === window || event.target === document || event.target.contains(triggerRef.current)
      // Ignore a scroll event queued before the field opened at its new position.
      if (!ancestor || rect && (rect.top !== anchorRef.current.top || rect.left !== anchorRef.current.left)) close()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const popup = popupRef.current
    const option = popup?.querySelector(`[data-option-index="${active}"]`)
    if (!option) return
    const top = option.offsetTop
    const bottom = top + option.offsetHeight
    if (top < popup.scrollTop) popup.scrollTop = top
    else if (bottom > popup.scrollTop + popup.clientHeight) popup.scrollTop = bottom - popup.clientHeight
  }, [open, active])

  const keyDown = (event) => {
    if (disabled || !options.length) return
    const { key } = event
    if (key === 'Tab') { if (open) commit(); return }
    if (key === 'Escape') { if (open) { event.preventDefault(); close() }; return }
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'PageUp', 'PageDown'].includes(key)) {
      event.preventDefault()
      if (key === 'Enter' || key === ' ' || (event.altKey && key === 'ArrowUp')) {
        if (open) commit()
        else show()
      } else if (key === 'Home' || key === 'End') {
        const next = key === 'Home' ? 0 : options.length - 1
        if (open) setActiveIndex(next)
        else show(next)
      } else if (!open) show()
      else setActiveIndex(Math.max(0, Math.min(options.length - 1, active + (key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : key === 'PageDown' ? 10 : -10))))
      return
    }
    if (key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return
    event.preventDefault()
    const now = Date.now()
    const text = (now - typedRef.current.time < 700 ? typedRef.current.text : '') + key.toLocaleLowerCase()
    const repeated = [...text].every((character) => character === text[0])
    const needle = repeated ? text[0] : text
    const start = repeated ? (open ? active : selectedIndex) + 1 : 0
    const match = Array.from({ length: options.length }, (_, offset) => (Math.max(0, start) + offset) % options.length)
      .find((index) => options[index].label.toLocaleLowerCase().startsWith(needle))
    if (!open) show(match ?? Math.max(0, selectedIndex))
    else if (match !== undefined) setActiveIndex(match)
    typedRef.current = { text, time: now }
  }

  return <>
    <button type="button" ref={triggerRef} className="student-directory-select" role="combobox"
      aria-labelledby={`${id}-label`} aria-describedby={`${id}-value`} aria-haspopup="listbox"
      aria-expanded={open} aria-controls={open ? `${id}-listbox` : undefined}
      aria-activedescendant={open && options[active] ? `${id}-option-${active}` : undefined}
      disabled={disabled} onKeyDown={keyDown} onClick={() => open ? close() : show()}>
      <span className="student-directory-select-text"><span id={`${id}-label`} className="student-directory-select-label">{label}</span><span id={`${id}-value`} className="student-directory-select-value">{options[selectedIndex]?.label || options[0]?.label || '—'}</span></span>
      <PortalIcon name="chevron-right" className="student-directory-select-chevron" size={16}/>
    </button>
    {open && createPortal(<div ref={popupRef} id={`${id}-listbox`} role="listbox" aria-labelledby={`${id}-label`} className="student-directory-select-menu" style={position}
      onPointerDown={(event) => event.preventDefault()}>
      {options.map((option, index) => <Fragment key={option.value}>
        {option.section && option.section !== options[index - 1]?.section && <div id={`${id}-section`} role="presentation" className="student-directory-select-section">{option.section}</div>}
        <div id={`${id}-option-${index}`} role="option" aria-describedby={option.section ? `${id}-section` : undefined}
        aria-selected={option.value === value} data-active={index === active} data-option-index={index} className="student-directory-select-option"
        onPointerMove={() => setActiveIndex(index)} onClick={() => { onChange(option.value); close(); triggerRef.current?.focus() }}>
        <span>{option.label}</span>{option.value === value && <PortalIcon name="check" size={17}/>}
      </div></Fragment>)}
    </div>, document.body)}
  </>
}
