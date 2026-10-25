import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { installPublicCursor } from './publicCursor.js'

gsap.registerPlugin(ScrollTrigger)

export function animateLanding(root) {
  const media = gsap.matchMedia()
  const removals = []
  const dispose = () => {
    removals.splice(0).reverse().forEach(remove => remove())
    root.removeAttribute('data-cursor')
  }
  const listen = (element, name, handler) => {
    element.addEventListener(name, handler)
    removals.push(() => element.removeEventListener(name, handler))
  }
  try {
    media.add({ all: '(min-width: 0px)', pointer: '(hover: hover) and (pointer: fine)', forced: '(forced-colors: active)' }, context => {
      const select = gsap.utils.selector(root)
      if (!root.dataset.introPlayed) {
        root.dataset.introPlayed = 'true'
        const elements = select('[data-hero-word], [data-hero-reveal]')
        let intro, fallback
        context.add('finishHero', () => {
          clearTimeout(fallback)
          intro?.kill()
          gsap.set(elements, { clearProps: 'opacity,transform,translate,rotate,scale' })
        })
        intro = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: context.finishHero })
          .fromTo(select('[data-hero-word]'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .8, stagger: .085 })
          .fromTo(select('[data-hero-reveal]'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .7, stagger: .1 }, .25)
        // A stopped ticker must never leave essential content invisible.
        fallback = setTimeout(context.finishHero, 2000)
        removals.push(() => clearTimeout(fallback))
      }
      for (const section of select('[data-section-reveal]')) {
        gsap.fromTo(section, { opacity: 0, y: 28 }, { opacity: 1, y: 0, clearProps: 'opacity,transform,translate,rotate,scale', duration: .75, ease: 'power2.out', scrollTrigger: { trigger: section, start: 'top 94%', once: true } })
      }
      for (const group of select('.landing-feature-grid, .landing-steps-panel ol')) {
        gsap.fromTo(group.children, { opacity: 0, y: 18 }, { opacity: 1, y: 0, clearProps: 'opacity,transform,translate,rotate,scale', duration: .65, stagger: .12, scrollTrigger: { trigger: group, start: 'top 92%', once: true } })
      }
      const floating = [
        ...select('[data-orbit]').map(element => ({ element, tween: gsap.fromTo(element, { x: -12, y: -22, rotation: -3 }, { x: 12, y: 22, rotation: 3, duration: 4.8, repeat: -1, yoyo: true, ease: 'sine.inOut', paused: true }) })),
        ...select('[data-float]').map(element => ({ element, tween: gsap.fromTo(element, { y: -7 }, { y: 7, duration: 3.5, repeat: -1, yoyo: true, ease: 'sine.inOut', paused: true }) })),
      ].map(item => ({ ...item, visible: false }))
      const sync = () => floating.forEach(item => item.tween.paused(document.hidden || !item.visible))
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          const item = floating.find(item => item.element === entry.target)
          if (item) item.visible = entry.isIntersecting
        }
        sync()
      })
      removals.push(() => observer.disconnect())
      floating.forEach(item => {
        observer.observe(item.element)
      })
      listen(document, 'visibilitychange', sync)

      let activePanel
      context.add('revealPanel', () => {
        const panel = root.querySelector('.landing-preview-panel:not([hidden])')
        if (!panel || panel === activePanel) return
        activePanel = panel
        gsap.fromTo(panel, { opacity: .35, y: 5 }, { opacity: 1, y: 0, duration: .3, overwrite: true })
        const bar = panel.querySelector('.landing-progress-track > span')
        if (bar) gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left center', duration: .9, ease: 'power2.out' })
        const items = panel.querySelectorAll('.landing-clearance-list li')
        if (items.length) gsap.fromTo(items, { opacity: .3, x: 8 }, { opacity: 1, x: 0, duration: .3, stagger: .07 })
      })
      context.revealPanel()
      const panels = new MutationObserver(() => context.revealPanel())
      panels.observe(root.querySelector('.landing-preview'), { attributes: true, attributeFilter: ['hidden'], subtree: true })
      removals.push(() => panels.disconnect())

      if (context.conditions.pointer && !context.conditions.forced) {
        const quick = (element, property, duration = .45) => gsap.quickTo(element, property, { duration, ease: 'power3.out' })
        const interactive = 'a, button, summary, [role="tab"]'
        const visual = root.querySelector('.landing-hero-visual')
        const ribbon = root.querySelector('.landing-ribbon-parallax')
        const preview = root.querySelector('.landing-preview-parallax')
        const ribbonX = quick(ribbon, 'x'), ribbonY = quick(ribbon, 'y')
        const previewX = quick(preview, 'x'), previewY = quick(preview, 'y')
        let heroBounds
        const resetHero = () => { ribbonX(0); ribbonY(0); previewX(0); previewY(0); heroBounds = null }
        listen(visual, 'pointerenter', () => { heroBounds = visual.getBoundingClientRect() })
        listen(visual, 'pointermove', event => {
          if (event.pointerType !== 'mouse') return
          const rect = heroBounds ||= visual.getBoundingClientRect()
          const dx = gsap.utils.clamp(-.5, .5, (event.clientX - rect.left) / rect.width - .5)
          const dy = gsap.utils.clamp(-.5, .5, (event.clientY - rect.top) / rect.height - .5)
          ribbonX(dx * -24); ribbonY(dy * -16)
          const steady = event.target.closest(interactive) || preview.querySelector(':focus-visible')
          if (steady) { previewX.tween.pause(); previewY.tween.pause() }
          else { previewX(dx * 12); previewY(dy * 8) }
        })
        listen(visual, 'pointerleave', resetHero)
        listen(visual, 'focusin', () => { previewX.tween.pause(); previewY.tween.pause() })
        listen(window, 'resize', resetHero)
        listen(window, 'scroll', () => { heroBounds = null })
        for (const element of select('[data-tilt]')) {
          const feature = element.dataset.tilt === 'feature'
          const x = quick(element, 'rotationY'), y = quick(element, 'rotationX'), lift = quick(element, 'y')
          let bounds
          const reset = () => { x(0); y(0); lift(0); element.removeAttribute('data-hover'); bounds = null }
          listen(element, 'pointerenter', () => { bounds = element.getBoundingClientRect() })
          listen(element, 'pointermove', event => {
            if (event.pointerType !== 'mouse') return
            if (event.target.closest(interactive) || element.querySelector(':focus-visible')) { x.tween.pause(); y.tween.pause(); lift.tween.pause(); return }
            const rect = bounds ||= element.getBoundingClientRect()
            const dx = gsap.utils.clamp(-.5, .5, (event.clientX - rect.left) / rect.width - .5)
            const dy = gsap.utils.clamp(-.5, .5, (event.clientY - rect.top) / rect.height - .5)
            x(dx * (feature ? 6 : 18)); y(dy * (feature ? -6 : -14)); lift(feature ? -8 : 0)
            if (feature) {
              element.dataset.hover = 'true'
              element.style.setProperty('--highlight-x', `${(dx + .5) * 100}%`)
              element.style.setProperty('--highlight-y', `${(dy + .5) * 100}%`)
            }
          })
          listen(element, 'pointerleave', reset)
          listen(element, 'focusin', () => { x.tween.pause(); y.tween.pause(); lift.tween.pause() })
          removals.push(() => { element.removeAttribute('data-hover'); element.style.removeProperty('--highlight-x'); element.style.removeProperty('--highlight-y') })
        }
        const campus = root.querySelector('.landing-campus-panel')
        const campusX = quick(campus.querySelector('img'), 'x'), campusY = quick(campus.querySelector('img'), 'y')
        listen(campus, 'pointermove', event => {
          if (event.pointerType !== 'mouse') return
          const rect = campus.getBoundingClientRect()
          campusX(((event.clientX - rect.left) / rect.width - .5) * 12)
          campusY(((event.clientY - rect.top) / rect.height - .5) * 12)
        })
        listen(campus, 'pointerleave', () => { campusX(0); campusY(0) })
        for (const element of select('[data-magnetic]')) {
          const x = quick(element, 'x'), y = quick(element, 'y')
          const reset = () => { x(0); y(0) }
          let bounds
          listen(element, 'pointerenter', () => { bounds = element.getBoundingClientRect() })
          listen(element, 'pointermove', event => {
            if (event.pointerType !== 'mouse' || event.buttons || element.matches(':focus-visible')) return
            const rect = bounds ||= element.getBoundingClientRect()
            x(gsap.utils.clamp(-5, 5, (event.clientX - rect.left - rect.width / 2) * .1))
            y(gsap.utils.clamp(-4, 4, (event.clientY - rect.top - rect.height / 2) * .1))
          })
          listen(element, 'pointerleave', reset); listen(element, 'pointerdown', reset); listen(element, 'focusin', reset)
        }
        removals.push(installPublicCursor(root))
      }
      return dispose
    }, root)
  } catch (error) {
    dispose(); media.revert()
    throw error
  }
  return () => { dispose(); media.revert() }
}
