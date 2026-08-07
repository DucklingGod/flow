import { useEffect } from 'react'

/**
 * Reveals `[data-reveal]` elements as they scroll into view.
 *
 * Two safety properties matter more than the effect itself:
 *
 * 1. Content is visible by default. The hiding rule is scoped to
 *    `.js-reveal-ready`, a class this hook adds only once it is running, so a
 *    failed script or a missing IntersectionObserver leaves the page fully
 *    readable rather than blank.
 * 2. It does nothing at all when the visitor asked for reduced motion.
 */
export function useReveal(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const root = document.querySelector('.marketing')
    if (!root) return
    const targets = [...root.querySelectorAll<HTMLElement>('[data-reveal]')]
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      for (const el of targets) el.dataset.revealed = 'true'
      return
    }

    root.classList.add('js-reveal-ready')
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target as HTMLElement
          el.dataset.revealed = 'true'
          observer.unobserve(el)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
    )
    for (const el of targets) observer.observe(el)

    return () => {
      observer.disconnect()
      root.classList.remove('js-reveal-ready')
    }
  }, [enabled])
}
