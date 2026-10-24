// Runs inside the browser so the audit sees the final cascade, including lazy CSS.
export function auditThemeColors() {
  const findings = [], manualReview = [], cache = new Map()
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const rgb = color => {
    if (cache.has(color)) return cache.get(color)
    let channels
    if (/^rgba?\(/.test(color)) channels = color.match(/[\d.]+/g).map(Number)
    else {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = color
      context.fillRect(0, 0, 1, 1)
      const pixel = context.getImageData(0, 0, 1, 1).data
      channels = [pixel[0], pixel[1], pixel[2], pixel[3] / 255]
    }
    if (channels.length === 3) channels.push(1)
    cache.set(color, channels)
    return channels
  }
  const blend = (foreground, background) => background.slice(0, 3).map((value, index) => foreground[index] * foreground[3] + value * (1 - foreground[3]))
  const luminance = channels => channels.slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
  const contrast = (first, second) => {
    const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
    return (values[0] + .05) / (values[1] + .05)
  }
  const selector = element => `${element.parentElement?.tagName.toLowerCase()} > ${element.tagName.toLowerCase()}${element.id ? '#'+element.id : ''}${typeof element.className === 'string' && element.className.trim() ? '.'+element.className.trim().replaceAll(' ', '.') : ''}`
  const backgroundFor = element => {
    const layers = []
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current)
      if (style.backgroundImage !== 'none') return null
      for (const pseudo of ['::before', '::after']) {
        const layer = getComputedStyle(current, pseudo)
        if (layer.content !== 'none' && ['absolute','fixed'].includes(layer.position) && layer.display !== 'none' && Number(layer.opacity) > 0 && (rgb(layer.backgroundColor)[3] > 0 || layer.backgroundImage !== 'none')) return null
      }
      const color = rgb(style.backgroundColor)
      layers.push(color)
      if (color[3] === 1) break
    }
    return layers.reverse().reduce((base, color) => blend(color, base), [255, 255, 255])
  }
  let checked = 0
  for (const element of document.querySelectorAll('body *')) {
    if (!element.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }) || element.closest('script,style,.sr-only,[aria-hidden="true"]:not(svg)')) continue
    const rect = element.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) continue
    const style = getComputedStyle(element)
    const key = selector(element)
    const paper = element.closest('.certificate-preview,.clearance-certificate,.qr-mini,.qr-display-card canvas,.qr-display-card img,.signature-directory img,.signature-form > img,.signature-preview-grid img,.signature-picker img')
    if (paper) continue
    checked++
    const ownBackground = rgb(style.backgroundColor)
    if (document.documentElement.dataset.theme === 'dark' && ownBackground[3] >= .9 && luminance(ownBackground) > .65 && rect.width * rect.height > 150) findings.push({ selector:key, issue:'light surface', background:style.backgroundColor })
    const background = backgroundFor(element)
    if (element.matches('.offense-breakdown-content progress') && element.value > 0) {
      const series = style.getPropertyValue('--legend-color').trim()
      if (series) {
        const ratio = contrast(rgb(series), ownBackground)
        if (ratio < 3) findings.push({ selector:key, issue:'chart contrast', ratio:Number(ratio.toFixed(2)), color:series })
      }
    }
    if (element.matches('.analytics-bar-track > i') && element.parentElement) {
      const track = rgb(getComputedStyle(element.parentElement).backgroundColor)
      const ratio = contrast(ownBackground, track)
      if (ratio < 3) findings.push({ selector:key, issue:'chart contrast', ratio:Number(ratio.toFixed(2)), color:style.backgroundColor })
    }
    const text = [...element.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent.trim()).join(' ')
    if (!background) {
      if (text || element.matches('input,textarea,svg')) manualReview.push({ selector:key, issue:'layered background', text:text.slice(0, 70) })
      continue
    }
    const disabled = element.closest(':disabled,[disabled],[aria-disabled="true"]')
    const assess = (color, minimum, issue, content = text, opacity = 1) => {
      const foreground = [...rgb(color)]
      foreground[3] *= opacity
      const ratio = contrast(blend(foreground, background), background)
      if (ratio + .005 < minimum) findings.push({ selector:key, issue, text:content.slice(0, 70), ratio:Number(ratio.toFixed(2)), minimum, color, background:background.map(Math.round) })
    }
    if (!disabled && text && !element.matches('progress,svg') && !element.closest('svg')) {
      const large = parseFloat(style.fontSize) >= 24 || parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700
      assess(style.color, large ? 3 : 4.5, 'text contrast', text, Number(style.opacity))
    }
    if (!disabled && element.matches('input[placeholder],textarea[placeholder]') && !element.value && element.placeholder) {
      const placeholder = getComputedStyle(element, '::placeholder')
      assess(placeholder.color, 4.5, 'placeholder contrast', element.placeholder, Number(placeholder.opacity))
    }
    if (!disabled && element.matches('svg') && element.closest('button,a,summary,[role="button"]')) assess(style.color, 3, 'control icon contrast', element.closest('button,a,summary,[role="button"]').getAttribute('aria-label') || 'icon')
    if (!disabled && element.matches(':focus-visible') && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) {
      const adjacent = backgroundFor(element.parentElement)
      if (adjacent) {
        const ratio = contrast(blend(rgb(style.outlineColor), adjacent), adjacent)
        if (ratio < 3) findings.push({ selector:key, issue:'focus contrast', ratio:Number(ratio.toFixed(2)), color:style.outlineColor })
      }
    }
    if (!disabled && element.matches('input:not([type="hidden"],[type="checkbox"],[type="radio"],[type="range"]),textarea,select')) {
      const adjacent = backgroundFor(element.parentElement)
      if (adjacent && contrast(background, adjacent) < 3 && style.borderTopStyle !== 'none' && parseFloat(style.borderTopWidth) > 0) {
        const ratio = contrast(blend(rgb(style.borderTopColor), adjacent), adjacent)
        if (ratio < 3) findings.push({ selector:key, issue:'control border contrast', ratio:Number(ratio.toFixed(2)), color:style.borderTopColor })
      }
    }
    for (const pseudo of ['::before', '::after']) {
      const generated = getComputedStyle(element, pseudo)
      if (disabled || ['none', 'normal', '""'].includes(generated.content) || generated.display === 'none' || Number(generated.opacity) === 0 || !/^".+"$/.test(generated.content)) continue
      const surface = rgb(generated.backgroundColor)
      const pseudoBackground = blend(surface, background)
      const ratio = contrast(blend(rgb(generated.color), pseudoBackground), pseudoBackground)
      if (ratio < 4.5) findings.push({ selector:key+pseudo, issue:'generated text contrast', text:generated.content, ratio:Number(ratio.toFixed(2)), color:generated.color })
    }
  }
  return { findings, manualReview:[...new Map(manualReview.map(item => [item.selector, item])).values()], checked }
}
