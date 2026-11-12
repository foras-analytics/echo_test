import { computed, ref, shallowRef, watch } from 'vue'
import { accentColor } from './theme.js'
import { api, post } from './api.js'
import { compareInstants, contextRows, keywordColor, timelineLanes } from './model.js'

export function createEcho() {
  const archive = shallowRef(null), screen = ref('import'), loading = ref(false), error = ref('')
  const dark = ref(true)
  const clock = ref('source'), neighbors = ref(3), settings = ref(false)
  const order = ref([]), selectedChannels = ref([]), divider = ref(10), showChannels = ref(true), showKeywords = ref(true), showTime = ref(true)
  const start = ref(null), end = ref(null), activeIds = ref([]), keywords = ref([]), groups = ref([])
  const anchors = ref(new Set()), queryResult = shallowRef({ ids: [], matches: {}, timing: [] }), querying = ref(false)
  const suggestions = shallowRef([]), suggestionStatus = ref('pending'), suggestionError = ref('')
  const visibleIds = ref([]), seekId = ref(null), seekVersion = ref(0)
  let sequence = 0, keywordSequence = 0, groupSequence = 0, generation = 0, timer, suggestionTimer
  const messages = computed(() => archive.value?.messages || [])
  const messageMap = computed(() => new Map(messages.value.map(m => [m.id, m])))
  const displayChannels = computed(() => (archive.value?.channels || []).map(c => ({ ...c, color: accentColor(c.color, dark.value) })))
  const channelMap = computed(() => new Map(displayChannels.value.map(c => [c.id, c])))
  const sortedKeywords = computed(() => [...keywords.value].sort((a, b) => a.text.localeCompare(b.text, 'de', { sensitivity: 'base' })))
  const selectedKeywords = computed(() => sortedKeywords.value.filter(k => activeIds.value.includes(k.id)))
  const sharedOffset = computed(() => clock.value === 'utc' ? 0 : archive.value?.summary.referenceOffset || 0)
  const rows = computed(() => contextRows(queryResult.value.ids, anchors.value, messages.value, neighbors.value))
  const baseMessages = computed(() => queryResult.value.ids.map(id => messageMap.value.get(id)))
  const lanes = computed(() => timelineLanes(order.value, selectedChannels.value, divider.value))
  const rangeError = computed(() => start.value !== null && end.value !== null && compareInstants(start.value, end.value) > 0 ? 'Start must be earlier than or equal to end.' : '')
  const visibleSpan = computed(() => {
    const primary = new Set(queryResult.value.ids)
    const times = visibleIds.value.filter(id => primary.has(id)).map(id => messageMap.value.get(id)?.timestampMs).filter(Number.isFinite)
    return times.length ? [Math.min(...times), Math.max(...times)] : null
  })
  async function refreshQuery() {
    const ticket = ++sequence
    if (!archive.value || rangeError.value) { querying.value = false; return }
    querying.value = true
    try {
      const result = await post('/query', { channels: selectedChannels.value, start: start.value, end: end.value, keywords: selectedKeywords.value.map(k => ({ id: k.id, text: k.text })) })
      if (ticket !== sequence) return
      queryResult.value = result
      const base = new Set(result.ids)
      anchors.value = new Set([...anchors.value].filter(id => base.has(id)))
      error.value = ''
    } catch (e) { if (ticket === sequence) error.value = e.message }
    finally { if (ticket === sequence) querying.value = false }
  }
  const keywordTerms = computed(() => selectedKeywords.value.map(k => ({ id: k.id, text: k.text })))
  watch(dark, value => { keywords.value.forEach(k => { k.color = accentColor(k.baseColor, value) }) })
  watch([selectedChannels, start, end, keywordTerms], () => {
    sequence++ // Discard in-flight results immediately when controls change.
    clearTimeout(timer)
    timer = setTimeout(refreshQuery, 100)
  }, { deep: true })
  async function pollSuggestions(ticket) {
    if (ticket !== generation) return
    try {
      const result = await api('/suggestions')
      if (ticket !== generation) return
      suggestionStatus.value = result.status
      suggestionError.value = result.error || ''
      suggestions.value = result.items
      if (result.status === 'pending') suggestionTimer = setTimeout(() => pollSuggestions(ticket), 500)
    } catch (e) {
      if (ticket === generation) { suggestionStatus.value = 'error'; suggestionError.value = e.message }
    }
  }
  async function load(file) {
    loading.value = true; error.value = ''
    try {
      let result
      if (file) {
        const form = new FormData(); form.append('file', file)
        result = await api('/import', { method: 'POST', body: form })
      } else result = await post('/demo', {})
      generation++; sequence++; clearTimeout(timer); clearTimeout(suggestionTimer)
      archive.value = result
      order.value = result.channels.map(c => c.id); selectedChannels.value = [...order.value]
      divider.value = Math.min(10, order.value.length)
      start.value = result.summary.first?.instant ?? null; end.value = result.summary.last?.instant ?? null
      activeIds.value = []; keywords.value = []; groups.value = []; anchors.value = new Set()
      queryResult.value = { ids: result.messages.map(m => m.id), matches: {}, timing: [] }
      suggestions.value = []; suggestionStatus.value = 'pending'; suggestionError.value = ''
      visibleIds.value = []; seekId.value = null
      screen.value = 'overview'
      pollSuggestions(generation)
    } catch (e) { error.value = e.message }
    finally { loading.value = false }
  }
  function resetRange() {
    start.value = archive.value?.summary.first?.instant ?? null
    end.value = archive.value?.summary.last?.instant ?? null
  }
  function addKeyword(text, groupId = null) {
    text = text.trim()
    if (!text) return null
    const existing = keywords.value.find(k => k.text.toLowerCase() === text.toLowerCase())
    if (existing) return existing
    const index = keywordSequence++
    const baseColor = keywordColor(index)
    const item = { id: `k${index}`, text, baseColor, color: accentColor(baseColor, dark.value), groupId }
    keywords.value.push(item)
    return item
  }
  function removeKeyword(id) {
    keywords.value = keywords.value.filter(k => k.id !== id)
    activeIds.value = activeIds.value.filter(kid => kid !== id)
  }
  function addGroup(name) {
    if (name.trim()) groups.value.push({ id: `g${groupSequence++}`, name: name.trim() })
  }
  function deleteGroup(id, deleteKeywords) {
    if (deleteKeywords) keywords.value.filter(k => k.groupId === id).forEach(k => removeKeyword(k.id))
    else keywords.value.forEach(k => { if (k.groupId === id) k.groupId = null })
    groups.value = groups.value.filter(g => g.id !== id)
  }
  function toggleKeyword(id) {
    activeIds.value = activeIds.value.includes(id) ? activeIds.value.filter(k => k !== id) : [...activeIds.value, id]
  }
  function toggleGroup(id) {
    const members = keywords.value.filter(k => k.groupId === id).map(k => k.id)
    const all = members.every(k => activeIds.value.includes(k))
    activeIds.value = all ? activeIds.value.filter(k => !members.includes(k)) : [...new Set([...activeIds.value, ...members])]
  }
  function toggleContext(id) {
    const next = new Set(anchors.value)
    if (next.has(id)) next.delete(id); else if (queryResult.value.ids.includes(id)) next.add(id)
    anchors.value = next
  }
  function seek(id, openContext = false) {
    if (openContext && queryResult.value.ids.includes(id)) anchors.value = new Set([...anchors.value, id])
    screen.value = 'explorer'; seekId.value = id; seekVersion.value++
  }
  return { dark, displayChannels, archive, screen, loading, error, clock, neighbors, settings, order, selectedChannels, divider, showChannels, showKeywords, showTime, sortedKeywords,
    start, end, activeIds, keywords, groups, anchors, queryResult, querying, suggestions, suggestionStatus, suggestionError,
    visibleIds, seekId, seekVersion, messages, messageMap, channelMap, selectedKeywords, sharedOffset, rows, baseMessages,
    lanes, rangeError, visibleSpan, load, resetRange, addKeyword, removeKeyword, addGroup, deleteGroup,
    toggleKeyword, toggleGroup, toggleContext, seek, refreshQuery }
}
