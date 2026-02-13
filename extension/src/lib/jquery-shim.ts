/**
 * Minimal jQuery-like shim for gmail.js.
 *
 * gmail.js declares jQuery as optional (`new Gmail(false)`) but many internal
 * methods — including the `observe.on('load')` event — use `$()` for DOM
 * queries. This shim implements just enough of the jQuery API to keep gmail.js
 * working for our use case (XHR interception, data reading, observe.on).
 *
 * Methods are intentionally kept minimal — only what gmail.js actually calls
 * during our code paths (construction, observe.on('load'), get.user_email,
 * get.visible_emails, new.get.email_data, get.email_source_async).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface MiniJQueryCollection {
  length: number
  [index: number]: Element | undefined

  find(selector: string): MiniJQueryCollection
  closest(selector: string): MiniJQueryCollection
  children(selector?: string): MiniJQueryCollection
  first(): MiniJQueryCollection
  parent(): MiniJQueryCollection
  parents(selector?: string): MiniJQueryCollection
  is(selector: string): boolean
  hasClass(className: string): boolean
  addClass(className: string): MiniJQueryCollection
  removeClass(className: string): MiniJQueryCollection
  attr(name: string, value?: string): any
  text(): string
  html(): string
  val(): string
  click(): MiniJQueryCollection
  mouseup(handler: (...args: any[]) => void): MiniJQueryCollection
  on(event: string, handler: (...args: any[]) => void): MiniJQueryCollection
}

function wrap(elements: Element[]): MiniJQueryCollection {
  const col: any = [...elements]
  col.length = elements.length

  col.find = function (sel: string) {
    const results: Element[] = []
    for (const el of elements) {
      results.push(...safeQueryAll(el, sel))
    }
    return wrap(results)
  }

  col.closest = function (sel: string) {
    for (const el of elements) {
      const match = el.closest(sel)
      if (match) return wrap([match])
    }
    return wrap([])
  }

  col.children = function (sel?: string) {
    const results: Element[] = []
    for (const el of elements) {
      const kids = Array.from(el.children)
      if (sel) {
        // Support :eq(n) pseudo-selector used by gmail.js
        const eqMatch = sel.match(/^:eq\((\d+)\)$/)
        if (eqMatch) {
          const idx = parseInt(eqMatch[1], 10)
          if (kids[idx]) results.push(kids[idx])
        } else {
          results.push(...kids.filter((k) => k.matches(sel)))
        }
      } else {
        results.push(...kids)
      }
    }
    return wrap(results)
  }

  col.first = function () {
    return wrap(elements.length > 0 ? [elements[0]] : [])
  }

  col.parent = function () {
    const results: Element[] = []
    for (const el of elements) {
      if (el.parentElement) results.push(el.parentElement)
    }
    return wrap(results)
  }

  col.parents = function (sel?: string) {
    const results: Element[] = []
    for (const el of elements) {
      let p = el.parentElement
      while (p) {
        if (!sel || p.matches(sel)) results.push(p)
        p = p.parentElement
      }
    }
    return wrap(results)
  }

  col.is = function (sel: string) {
    return elements.some((el) => el.matches(sel))
  }

  col.hasClass = function (cls: string) {
    return elements.some((el) => el.classList.contains(cls))
  }

  col.addClass = function (cls: string) {
    for (const el of elements) el.classList.add(cls)
    return col
  }

  col.removeClass = function (cls: string) {
    for (const el of elements) el.classList.remove(cls)
    return col
  }

  col.attr = function (name: string, value?: string) {
    if (value !== undefined) {
      for (const el of elements) el.setAttribute(name, value)
      return col
    }
    return elements[0]?.getAttribute(name) ?? undefined
  }

  col.text = function () {
    return elements[0]?.textContent ?? ''
  }

  col.html = function () {
    return elements[0]?.innerHTML ?? ''
  }

  col.val = function () {
    return (elements[0] as HTMLInputElement)?.value ?? ''
  }

  col.click = function () {
    for (const el of elements) (el as HTMLElement).click()
    return col
  }

  col.mouseup = function (handler: (...args: any[]) => void) {
    for (const el of elements) el.addEventListener('mouseup', handler)
    return col
  }

  col.on = function (event: string, handler: (...args: any[]) => void) {
    for (const el of elements) el.addEventListener(event, handler)
    return col
  }

  return col
}

/**
 * Convert jQuery pseudo-selectors to a CSS-compatible query.
 * Returns { selector, firstOnly } where firstOnly means :first was present.
 */
function sanitizeSelector(sel: string): { selector: string; firstOnly: boolean } {
  let firstOnly = false
  let s = sel

  // :first → use querySelector instead of querySelectorAll
  if (s.includes(':first')) {
    firstOnly = true
    s = s.replace(/:first/g, '')
  }

  // :visible → ignore (not a CSS pseudo), just remove it
  s = s.replace(/:visible/g, '')

  // :eq(n) → handled separately in .children(), strip it here for safety
  s = s.replace(/:eq\(\d+\)/g, '')

  // Clean up any trailing/leading whitespace or commas from removal
  s = s.replace(/,\s*,/g, ',').replace(/^[,\s]+|[,\s]+$/g, '')

  return { selector: s || '*', firstOnly }
}

function safeQueryAll(root: Element | Document, sel: string): Element[] {
  const { selector, firstOnly } = sanitizeSelector(sel)
  try {
    if (firstOnly) {
      const el = root.querySelector(selector)
      return el ? [el] : []
    }
    return Array.from(root.querySelectorAll(selector))
  } catch {
    // Invalid selector — return empty
    return []
  }
}

function miniJQuery(selector: any, context?: any): MiniJQueryCollection {
  if (!selector) return wrap([])

  // $(Element) or $(NodeList)
  if (selector instanceof Element) return wrap([selector])
  if (selector instanceof NodeList) return wrap(Array.from(selector) as Element[])

  // $("selector") or $("selector", context)
  if (typeof selector === 'string') {
    const root = context instanceof Element ? context : document
    return wrap(safeQueryAll(root, selector))
  }

  return wrap([])
}

// Static methods used by gmail.js
miniJQuery.param = function (obj: Record<string, any>, traditional?: boolean): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    if (traditional && Array.isArray(value)) {
      for (const v of value) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`)
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    }
  }
  return parts.join('&')
}

miniJQuery.merge = function (first: any[], second: any[]): any[] {
  for (const item of second) first.push(item)
  return first
}

miniJQuery.extend = function (...args: any[]): any {
  let deep = false
  let target = args[0]
  let start = 1
  if (typeof target === 'boolean') {
    deep = target
    target = args[1]
    start = 2
  }
  for (let i = start; i < args.length; i++) {
    const src = args[i]
    if (!src) continue
    for (const key of Object.keys(src)) {
      if (deep && typeof src[key] === 'object' && src[key] !== null && !Array.isArray(src[key])) {
        target[key] = miniJQuery.extend(true, target[key] || {}, src[key])
      } else {
        target[key] = src[key]
      }
    }
  }
  return target
}

miniJQuery.ajax = function (config: any): any {
  // gmail.js uses $.ajax for some operations — return a minimal thenable
  console.warn('[Sweepy:jQueryShim] $.ajax called but not supported:', config?.url)
  return { done: () => miniJQuery.ajax, fail: () => miniJQuery.ajax }
}

export { miniJQuery }
