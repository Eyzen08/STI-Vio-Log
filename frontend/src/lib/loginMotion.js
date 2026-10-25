import { gsap } from 'gsap'
import { installPublicCursor } from './publicCursor.js'

export function animateLogin(root) {
  const media = gsap.matchMedia()
  const removals = []
  let active = true
  const dispose = () => { active = false; removals.splice(0).reverse().forEach(remove => remove()) }
  const listen = (element, event, handler) => {
    element.addEventListener(event, handler)
    removals.push(() => element.removeEventListener(event, handler))
  }
  try {
    media.add({ all: '(min-width: 0px)', desktop: '(min-width: 1024px)', pointer: '(hover: hover) and (pointer: fine)', forced: '(forced-colors: active)' }, context => {
      active = true
      const intro = root.querySelector('.login-intro')
      const drift = root.querySelector('.login-campus-drift')
      const parallax = root.querySelector('.login-campus-parallax')
      const ribbon = root.querySelector('.login-ribbon')
      if (!root.dataset.introPlayed) {
        root.dataset.introPlayed = 'true'
        const targets = root.querySelectorAll('.login-brand-mark, .login-intro-content')
        let entrance, fallback, finished = false
        context.add('finishEntrance', () => {
          if (finished) return
          finished = true
          clearTimeout(fallback)
          entrance?.kill()
          gsap.set(targets, { clearProps: 'opacity,transform,translate,rotate,scale' })
        })
        entrance = gsap.fromTo(targets, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .65, stagger: .12, ease: 'power3.out', onComplete: context.finishEntrance })
        fallback = setTimeout(context.finishEntrance, 2000)
        removals.push(() => clearTimeout(fallback))
      }
      const floating = [gsap.fromTo(drift, { y: context.conditions.desktop ? -4 : -2 }, { y: context.conditions.desktop ? 4 : 2, duration: 7, repeat: -1, yoyo: true, ease: 'sine.inOut', paused: true })]
      if (context.conditions.desktop) floating.push(gsap.fromTo(ribbon, { y: -12, rotation: -2 }, { y: 12, rotation: 2, duration: 5.5, repeat: -1, yoyo: true, ease: 'sine.inOut', paused: true }))
      let visible = false
      const pointerTweens = []
      const blocked = () => document.hidden || !visible
      const sync = () => {
        if (!active) return
        const paused = blocked()
        floating.forEach(tween => tween.paused(paused))
        if (paused) {
          pointerTweens.forEach(move => move.tween.pause())
        }
      }
      const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync() })
      observer.observe(intro)
      removals.push(() => observer.disconnect())
      listen(document, 'visibilitychange', sync)
      if (context.conditions.pointer && !context.conditions.forced) {
        if (context.conditions.desktop) {
          const x = gsap.quickTo(parallax, 'x', { duration: .5, ease: 'power3.out' })
          const y = gsap.quickTo(parallax, 'y', { duration: .5, ease: 'power3.out' })
          pointerTweens.push(x, y)
          let bounds
          listen(intro, 'pointerenter', () => { bounds = intro.getBoundingClientRect() })
          listen(intro, 'pointermove', event => {
            if (event.pointerType !== 'mouse' || blocked()) return
            const rect = bounds ||= intro.getBoundingClientRect()
            x(gsap.utils.clamp(-8, 8, ((event.clientX - rect.left) / rect.width - .5) * 16))
            y(gsap.utils.clamp(-8, 8, ((event.clientY - rect.top) / rect.height - .5) * 16))
          })
          listen(intro, 'pointerleave', () => { if (!blocked()) { x(0); y(0) }; bounds = null })
          listen(window, 'resize', () => { bounds = null })
          listen(window, 'scroll', () => { bounds = null })
        }
        removals.push(installPublicCursor(root))
      }
      sync()
      return dispose
    }, root)
  } catch (error) {
    dispose(); media.revert()
    throw error
  }
  return () => { dispose(); media.revert() }
}
