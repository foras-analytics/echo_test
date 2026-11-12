// Pure interaction rules, shared by the UI and regression tests.
export const KEYWORD_COLORS = ['#bb601f', '#7058b2', '#138671', '#b24473', '#286ca5', '#8c761c', '#aa4747', '#587735']
export function keywordColor(index) {
  if (index < KEYWORD_COLORS.length) return KEYWORD_COLORS[index]
  const hue = (index * 137.508) % 360 / 60
  const chroma = .55, light = .16
  const secondary = chroma * (1 - Math.abs(hue % 2 - 1))
  const sectors = [[chroma, secondary, 0], [secondary, chroma, 0], [0, chroma, secondary], [0, secondary, chroma], [secondary, 0, chroma], [chroma, 0, secondary]]
  return '#' + sectors[Math.floor(hue)].map(value => Math.round((value + light) * 255).toString(16).padStart(2, '0')).join('')
}
export function compareInstants(a, b) {
  const parse = value => {
    const negative = value.startsWith('-')
    const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.')
    return { negative, whole: BigInt(whole), fraction }
  }
  const x = parse(a), y = parse(b)
  if (x.negative !== y.negative) return x.negative ? -1 : 1
  const width = Math.max(x.fraction.length, y.fraction.length)
  const sign = x.negative ? -1 : 1
  if (x.whole !== y.whole) return (x.whole < y.whole ? -1 : 1) * sign
  const xf = x.fraction.padEnd(width, '0'), yf = y.fraction.padEnd(width, '0')
  return (xf < yf ? -1 : xf > yf ? 1 : 0) * sign
}
export function contextRows(baseIds, anchors, messages, neighborCount) {
  const byId = new Map(messages.map(m => [m.id, m]))
  const primary = new Set(baseIds)
  const live = [...anchors].filter(id => primary.has(id))
  const channels = new Map()
  const positions = new Map()
  messages.forEach(m => {
    if (!channels.has(m.channelId)) channels.set(m.channelId, [])
    const list = channels.get(m.channelId)
    positions.set(m.id, list.length)
    list.push(m)
  })
  const intervals = new Map()
  const count = Math.max(0, Math.floor(neighborCount))
  live.forEach(id => {
    const m = byId.get(id), list = channels.get(m.channelId), index = positions.get(id)
    if (!intervals.has(m.channelId)) intervals.set(m.channelId, [])
    intervals.get(m.channelId).push({ start: Math.max(0, index - count), end: Math.min(list.length - 1, index + count), anchors: [id] })
  })
  const baseOrder = new Map(baseIds.map((id, i) => [id, i]))
  const groups = []
  intervals.forEach((items, cid) => {
    items.sort((a, b) => a.start - b.start)
    const merged = []
    items.forEach(item => {
      const last = merged.at(-1)
      if (last && item.start <= last.end) {
        last.end = Math.max(last.end, item.end)
        last.anchors.push(...item.anchors)
      } else merged.push({ ...item, anchors: [...item.anchors] })
    })
    merged.forEach(item => {
      const firstAnchor = item.anchors.reduce((a, b) => baseOrder.get(a) < baseOrder.get(b) ? a : b)
      groups.push({ ...item, key: `group-${firstAnchor}`, at: firstAnchor, ids: channels.get(cid).slice(item.start, item.end + 1).map(m => m.id) })
    })
  })
  const consumed = new Set(groups.flatMap(g => g.ids))
  const at = new Map(groups.map(g => [g.at, g]))
  const rows = []
  baseIds.forEach(id => {
    const group = at.get(id)
    if (group) {
      group.ids.forEach((mid, i) => {
        const reasons = group.anchors.filter(a => Math.abs(positions.get(a) - positions.get(mid)) <= count)
        rows.push({ id: mid, primary: primary.has(mid), group: group.key, groupStart: i === 0, groupEnd: i === group.ids.length - 1, anchor: live.includes(mid), reasons })
      })
    } else if (!consumed.has(id)) rows.push({ id, primary: true, group: null, anchor: false, reasons: [] })
  })
  return rows
}
export function timelineLanes(order, selected, divider) {
  const chosen = new Set(selected)
  const lanes = order.slice(0, divider).filter(id => chosen.has(id)).map(id => ({ id, members: [id] }))
  const rest = order.slice(divider).filter(id => chosen.has(id))
  if (rest.length) lanes.push({ id: 'other', members: rest })
  return lanes
}
export function nearestMessage(messages, timestampMs) {
  if (!messages.length) return null
  let lo = 0, hi = messages.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (messages[mid].timestampMs < timestampMs) lo = mid + 1
    else hi = mid
  }
  if (lo === 0) return messages[0]
  if (lo === messages.length) return messages.at(-1)
  return timestampMs - messages[lo - 1].timestampMs <= messages[lo].timestampMs - timestampMs ? messages[lo - 1] : messages[lo]
}
export function highlightedParts(text, keywords) {
  if (!text) return []
  // Map lowercased positions back to original code units (e.g. dotted capital İ).
  let lower = '', boundaries = []
  let index = 0
  for (const char of text) {
    const folded = char.toLowerCase()
    for (let j = 0; j < folded.length; j++) boundaries.push({ start: index, end: index + char.length })
    lower += folded
    index += char.length
  }
  lower = text.toLowerCase() // Preserve context-dependent lowercase rules as well.
  const spans = []
  keywords.forEach(k => {
    const term = k.text.toLowerCase()
    if (!term) return
    let from = 0, hit
    while ((hit = lower.indexOf(term, from)) !== -1) {
      spans.push({ start: boundaries[hit].start, end: boundaries[hit + term.length - 1].end, keyword: k })
      from = hit + 1
    }
  })
  const points = [...new Set([0, text.length, ...spans.flatMap(s => [s.start, s.end])])].sort((a, b) => a - b)
  return points.slice(0, -1).map((start, i) => ({ text: text.slice(start, points[i + 1]), keywords: spans.filter(s => s.start <= start && s.end >= points[i + 1]).map(s => s.keyword) }))
}
export function offsetLabel(minutes) {
  return minutes === 0 ? 'UTC' : `UTC${minutes >= 0 ? '+' : '−'}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0')}:${String(Math.abs(minutes) % 60).padStart(2, '0')}`
}
export function formatTime(ms, offset = 0, compact = false) {
  const d = new Date(ms + offset * 60000)
  if (Number.isNaN(d.getTime())) return '—'
  const iso = d.toISOString()
  return compact ? iso.slice(5, 10) + ' ' + iso.slice(11, 19) : iso.slice(0, 10) + ' ' + iso.slice(11, 23) + ' ' + offsetLabel(offset)
}
export function inputTime(ms, offset = 0) {
  return new Date(ms + offset * 60000).toISOString().slice(0, 23)
}
export function inputToInstant(value, offset = 0) {
  // UTC suffix prevents the operating system's timezone and DST from altering the clock.
  return String((Date.parse(value + 'Z') - offset * 60000) / 1000)
}
export function duration(seconds) {
  if (seconds === null || seconds === undefined) return '—'
  if (seconds === 0) return '0 s'
  const abs = Math.abs(seconds)
  if (abs < 1) return `${+(seconds * 1000).toPrecision(4)} ms`
  if (abs < 60) return `${+seconds.toFixed(3)} s`
  if (abs < 3600) return `${+(seconds / 60).toFixed(2)} min`
  if (abs < 86400) return `${+(seconds / 3600).toFixed(2)} h`
  return `${+(seconds / 86400).toFixed(2)} d`
}
