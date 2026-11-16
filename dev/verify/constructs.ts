// The kinds of markup and CSS a scene is written with, each as one short tag:
// element and attribute names, at-rules, CSS functions, properties (and which
// of them keyframes animate), selector shapes and a few value keywords.
//
// The desktop app draws the scene in a frame of its own, and some constructs
// that headless Chromium plays happily stop every animation there, with no
// error anywhere (`d:path()` keyframes, an aspect-ratio media rule). Nothing
// short of looking at the app tells such a construct apart, so a scene may use
// only what the app has already been seen to animate with: `PROVEN`.

const KEYWORDS = ['none', 'both', 'forwards', 'backwards', 'step-end', 'step-start', 'infinite', 'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'alternate', 'reverse', 'paused', 'currentColor', 'inherit', 'transparent', 'fill-box', 'view-box']

const PAINT = ['fill', 'stroke', 'color', 'opacity', 'fill-opacity', 'stroke-opacity', 'stop-color']

export function constructsOf(svg: string): Set<string> {
  const out = new Set<string>()
  const styles = [...svg.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1] ?? '')
  const markup = svg.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
  const inline = [...markup.matchAll(/\sstyle="([^"]*)"/g)].map(m => m[1] ?? '')
  for (const m of markup.matchAll(/<([a-zA-Z][\w:-]*)/g)) out.add(`el:${m[1]}`)
  for (const m of markup.matchAll(/\s([a-zA-Z][\w:-]*)=["']/g)) out.add(`attr:${m[1]}`)
  const css = styles.join('\n')
  const declarations = `${css}\n${inline.map(s => `{${s}}`).join('\n')}`
  for (const m of css.matchAll(/@([a-z-]+)/g)) out.add(`at:${m[1]}`)
  // A media rule by what it asks: an aspect-ratio one froze the app.
  for (const m of css.matchAll(/@media[^{]*?\(\s*([a-z-]+)/g)) out.add(`media:${m[1]}`)
  for (const m of declarations.matchAll(/(?<![\w-])([a-z][a-z-]*)\(/g)) out.add(`fn:${m[1]}`)
  for (const m of declarations.matchAll(/[{;]\s*(-?-?[a-zA-Z][\w-]*)\s*:/g)) {
    const name = m[1] ?? ''
    out.add(`prop:${name.startsWith('--') ? '--*' : name}`)
  }
  for (const m of declarations.matchAll(/:([^;{}]*)/g)) {
    for (const word of (m[1] ?? '').match(/[a-zA-Z][\w-]*/g) ?? []) if (KEYWORDS.includes(word)) out.add(`kw:${word}`)
  }
  const keyframes = /@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*\s*\}/g
  for (const block of css.match(keyframes) ?? []) {
    for (const m of block.matchAll(/[{;]\s*([a-z-]+)\s*:/g)) out.add(`animates:${m[1]}`)
  }
  // A presentation attribute that a class or id rule overrides on the same
  // element, by property: the reef's night colours overrode `fill` attributes
  // this way, and that alone stopped every animation in the app.
  // Each simple `.class` or `#id` selector, with the properties its rules set
  // and the paint properties among them set to a value other than `none`.
  const ruled = new Map<string, Set<string>>()
  const painted = new Map<string, Set<string>>()
  for (const m of css.replace(keyframes, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const pairs = [...(m[2] ?? '').matchAll(/([a-z-]+)\s*:\s*([^;]*)/g)].map(p => [p[1] ?? '', (p[2] ?? '').trim()] as const)
    for (const part of (m[1] ?? '').split(',')) {
      const simple = /^\s*([.#][\w-]+)\s*$/.exec(part)
      if (simple === null) continue
      const known = ruled.get(simple[1] ?? '') ?? new Set<string>()
      const paints = painted.get(simple[1] ?? '') ?? new Set<string>()
      for (const [prop, value] of pairs) {
        known.add(prop)
        if (value !== 'none' && PAINT.includes(prop)) paints.add(prop)
      }
      ruled.set(simple[1] ?? '', known)
      painted.set(simple[1] ?? '', paints)
    }
  }
  for (const m of markup.matchAll(/<[a-zA-Z][^<>]*>/g)) {
    const tag = m[0]
    const names = [...(/\sclass="([^"]*)"/.exec(tag)?.[1] ?? '').split(/\s+/).filter(c => c !== '').map(c => `.${c}`), ...[/\sid="([^"]*)"/.exec(tag)?.[1]].filter(i => i !== undefined).map(i => `#${i}`)]
    for (const name of names) {
      for (const prop of ruled.get(name) ?? []) if (new RegExp(`\\s${prop}="`).test(tag)) out.add(`override:${prop}`)
    }
  }
  // A class rule colouring a shape inside a `<use>`'s target, for a property
  // a rule also sets on that `<use>` itself (`use[href^="#q"]` sets `fill`):
  // rules filling the reef's fish with colours this way froze the app in
  // either scheme. `fill:none` there, stroke rules on the same shapes and fill
  // rules on shapes under unstyled uses all played.
  const onUse: { prefix: string; props: string[] }[] = []
  for (const m of css.replace(keyframes, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const props = [...(m[2] ?? '').matchAll(/([a-z-]+)\s*:/g)].map(p => p[1] ?? '')
    for (const part of (m[1] ?? '').split(',')) {
      const last = part.trim().split(/[\s>]+/).pop() ?? ''
      const use = /^use(?:\[href\^="#([^"]*)"\])?$/.exec(last)
      if (use !== null) onUse.push({ prefix: use[1] ?? '', props })
    }
  }
  const usedAs = new Map<string, Set<string>>()
  for (const m of markup.matchAll(/<use\b[^>]*\shref="#([^"]+)"/g)) {
    const id = m[1] ?? ''
    const props = usedAs.get(id) ?? new Set<string>()
    for (const rule of onUse) if (id.startsWith(rule.prefix)) for (const prop of rule.props) props.add(prop)
    usedAs.set(id, props)
  }
  const inside: Set<string>[] = []
  for (const m of markup.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^<>]*?)(\/?)>/g)) {
    const [, closing, , attrs = '', selfClosing] = m
    if (closing === '/') {
      inside.pop()
      continue
    }
    const id = /\sid="([^"]*)"/.exec(attrs)?.[1]
    const styled = new Set([...(inside[inside.length - 1] ?? []), ...(id === undefined ? [] : usedAs.get(id) ?? [])])
    const names = (/\sclass="([^"]*)"/.exec(attrs)?.[1] ?? '').split(/\s+/).filter(c => c !== '').map(c => `.${c}`)
    for (const name of names) for (const prop of painted.get(name) ?? []) if (styled.has(prop)) out.add(`under-styled-use:${prop}`)
    if (selfClosing !== '/') inside.push(styled)
  }
  // Selector shapes: class, id and quoted values stand for any.
  const rules = css.replace(keyframes, '').replace(/@media[^{]*\{/g, '')
  for (const m of rules.matchAll(/([^{}]+)\{/g)) {
    for (const part of (m[1] ?? '').split(',')) {
      const shape = part.trim().replace(/\.[\w-]+/g, '.c').replace(/#[\w-]+/g, '#i').replace(/"[^"]*"/g, '"…"')
      if (shape !== '') out.add(`sel:${shape}`)
    }
  }
  return out
}

// What the app has been seen to animate with: every construct of the scenes
// as last committed, which the person used for days, and the few added since
// that a scene they watched moving already had. Add to it only after looking
// at a scene that uses the new construct in the desktop app and seeing it move.
export const PROVEN: ReadonlySet<string> = new Set([
  "el:circle", "el:clipPath", "el:defs", "el:ellipse", "el:feGaussianBlur", "el:filter", "el:g", "el:line", "el:linearGradient", "el:mask", "el:path", "el:pattern", "el:radialGradient", "el:rect", "el:stop", "el:svg", "el:use",
  "attr:class", "attr:clip-path", "attr:clip-rule", "attr:cx", "attr:cy", "attr:d", "attr:data-b", "attr:fill", "attr:filter", "attr:gradientUnits", "attr:height", "attr:href", "attr:id", "attr:mask", "attr:offset", "attr:opacity", "attr:patternUnits", "attr:preserveAspectRatio", "attr:r", "attr:rx", "attr:ry", "attr:stdDeviation", "attr:stop-color", "attr:stop-opacity", "attr:stroke", "attr:stroke-linecap", "attr:stroke-linejoin", "attr:stroke-width", "attr:style", "attr:transform", "attr:viewBox", "attr:width", "attr:x", "attr:x1", "attr:x2", "attr:xmlns", "attr:y", "attr:y1", "attr:y2",
  "at:keyframes", "at:media", "media:prefers-color-scheme",
  "fn:calc", "fn:cubic-bezier", "fn:rotate", "fn:scale", "fn:steps", "fn:translate", "fn:var",
  "prop:--*", "prop:animation", "prop:animation-delay", "prop:animation-direction", "prop:animation-duration", "prop:animation-fill-mode", "prop:animation-iteration-count", "prop:animation-name", "prop:animation-timing-function", "prop:display", "prop:fill", "prop:opacity", "prop:stop-color", "prop:stroke", "prop:stroke-dasharray", "prop:stroke-dashoffset", "prop:stroke-linecap", "prop:stroke-width", "prop:transform", "prop:transform-box", "prop:transform-origin",
  "animates:animation-timing-function", "animates:fill", "animates:opacity", "animates:stroke-dashoffset", "animates:transform",
  "kw:both", "kw:ease-in", "kw:ease-in-out", "kw:ease-out", "kw:fill-box", "kw:forwards", "kw:infinite", "kw:linear", "kw:none", "kw:reverse", "kw:step-end", "kw:view-box",
  "sel:#i", "sel:.c", "sel:.c .c use", "sel:.c .c>*", "sel:.c .c>g", "sel:.c use", "sel:.c.c", "sel:.c>*", "sel:.c>g",
  // Seen moving in the app in a forced-dark scene, where night rules override
  // these attributes (a `fill` overridden the same way froze it).
  'override:opacity', 'override:stroke',
  // In the scenes as last committed.
  'override:stroke-width',
  // Watched moving in the app with the reef's shapes in place.
  'kw:currentColor', 'prop:color', 'sel:use[href^="…"]', 'sel:*',
])
