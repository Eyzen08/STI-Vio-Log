import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function animateLanding(root) {
  const media = gsap.matchMedia()
  try {
    media.add({ reduce: '(prefers-reduced-motion: reduce)', animate: '(prefers-reduced-motion: no-preference)', pointer: '(hover: hover) and (pointer: fine)' }, context => {
    if (context.conditions.reduce) return undefined
    const select = gsap.utils.selector(root)
    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
    intro.from(select('[data-hero-word]'), { opacity: 0, y: 30, duration: .8, stagger: .085 })
      .from(select('[data-hero-reveal]'), { opacity: 0, y: 16, duration: .7, stagger: .1 }, .25)
    for (const section of select('[data-section-reveal]')) {
      gsap.from(section, { opacity: 0, y: 24, duration: .7, ease: 'power2.out', scrollTrigger: { trigger: section, start: 'top 94%', once: true } })
    }
    const floating = select('[data-float]').map((element, index) => ({ element, tween: gsap.to(element, { y: index ? -8 : -12, duration: index ? 5 : 7, repeat: -1, yoyo: true, ease: 'sine.inOut', paused: true }), visible: false, interacting: false }))
    const sync = () => floating.forEach(item => item.tween.paused(document.hidden || !item.visible || item.interacting))
    const removeInteraction = floating.map(item => {
      const enter = () => { item.interacting = true; sync() }
      const leave = () => { item.interacting = item.element.matches(':hover') || item.element.contains(document.activeElement); sync() }
      item.element.addEventListener('pointerenter', enter)
      item.element.addEventListener('pointerleave', leave)
      item.element.addEventListener('focusin', enter)
      item.element.addEventListener('focusout', leave)
      return () => { item.element.removeEventListener('pointerenter', enter); item.element.removeEventListener('pointerleave', leave); item.element.removeEventListener('focusin', enter); item.element.removeEventListener('focusout', leave) }
    })
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const item = floating.find(item => item.element === entry.target)
        if (item) item.visible = entry.isIntersecting
      }
      sync()
    })
    floating.forEach(item => observer.observe(item.element))
    document.addEventListener('visibilitychange', sync)
    const removePointer = []
    if (context.conditions.pointer) {
      for (const element of select('[data-magnetic], [data-tilt]')) {
        const tilt = element.hasAttribute('data-tilt')
        const x = gsap.quickTo(element, tilt ? 'rotationY' : 'x', { duration: .4, ease: 'power3.out' })
        const y = gsap.quickTo(element, tilt ? 'rotationX' : 'y', { duration: .4, ease: 'power3.out' })
        const move = event => {
          if (event.pointerType !== 'mouse') return
          const rect = element.getBoundingClientRect()
          const dx = (event.clientX - rect.left) / rect.width - .5
          const dy = (event.clientY - rect.top) / rect.height - .5
          x(dx * (tilt ? 5 : 10))
          y(dy * (tilt ? -5 : 8))
        }
        const reset = () => { x(0); y(0) }
        element.addEventListener('pointermove', move)
        element.addEventListener('pointerleave', reset)
        removePointer.push(() => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerleave', reset) })
      }
    }
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync); removeInteraction.forEach(remove => remove()); removePointer.forEach(remove => remove()) }
    }, root)
  } catch (error) {
    media.revert()
    throw error
  }
  return () => media.revert()
}
