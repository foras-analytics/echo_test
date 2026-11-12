<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import HighlightText from './HighlightText.vue'
import { compareInstants, formatTime } from '../model.js'
const props = defineProps({ echo: Object })
const e = props.echo
const container = ref(null), scrollTop = ref(0), viewportHeight = ref(600), revision = ref(0)
const heights = new Map(), elements = new Map()
let observer, frame, correcting = false
const rows = computed(() => e.rows.value)
const offsets = computed(() => {
  revision.value
  const list = [0]
  rows.value.forEach(row => list.push(list.at(-1) + (heights.get(row.id) || 118)))
  return list
})
function locate(y) {
  const points = offsets.value
  let lo = 0, hi = rows.value.length
  while (lo < hi) { const mid = (lo + hi) >> 1; if (points[mid + 1] < y) lo = mid + 1; else hi = mid }
  return lo
}
const first = computed(() => Math.max(0, locate(scrollTop.value) - 8))
const last = computed(() => Math.min(rows.value.length, locate(scrollTop.value + viewportHeight.value) + 10))
const windowRows = computed(() => rows.value.slice(first.value, last.value))
function visible() {
  if (!container.value) return
  const bounds = container.value.getBoundingClientRect()
  e.visibleIds.value = [...elements].filter(([, el]) => {
    const r = el.getBoundingClientRect()
    return r.bottom > bounds.top + 1 && r.top < bounds.bottom - 1
  }).map(([id]) => id)
}
function onScroll() {
  scrollTop.value = container.value?.scrollTop || 0
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(visible)
}
function register(id, element) {
  const previous = elements.get(id)
  if (previous && previous !== element) observer?.unobserve(previous)
  if (!element) elements.delete(id)
  else { elements.set(id, element); observer?.observe(element) }
}
function topSnapshot() {
  if (!container.value || !rows.value.length) return null
  const bounds = container.value.getBoundingClientRect()
  const visibleRows = [...elements].filter(([, el]) => el.getBoundingClientRect().bottom > bounds.top)
    .sort((a, b) => a[1].getBoundingClientRect().top - b[1].getBoundingClientRect().top)
  if (!visibleRows.length) return null
  const [id, el] = visibleRows[0]
  return { id, top: el.getBoundingClientRect().top - bounds.top, ms: e.messageMap.value.get(id)?.timestampMs }
}
watch(rows, async (next, old) => {
  const snapshot = topSnapshot()
  if (!container.value) return
  const anchor = snapshot && next.findIndex(r => r.id === snapshot.id)
  let index = anchor
  if (snapshot && anchor === -1 && next.length) {
    index = next.reduce((best, row, i) => Math.abs(e.messageMap.value.get(row.id).timestampMs - snapshot.ms) < Math.abs(e.messageMap.value.get(next[best].id).timestampMs - snapshot.ms) ? i : best, 0)
  }
  // Clear measurements for presentation changes (context labels and controls).
  const prior = new Map((old || []).map(r => [r.id, r]))
  next.forEach(r => { const p = prior.get(r.id); if (!p || p.group !== r.group || p.primary !== r.primary || p.anchor !== r.anchor) heights.delete(r.id) })
  revision.value++
  if (snapshot && index >= 0) container.value.scrollTop = Math.max(0, offsets.value[index] - snapshot.top)
  else container.value.scrollTop = 0
  onScroll()
  await nextTick(); visible()
}, { flush: 'pre' })
async function center(id) {
  const index = rows.value.findIndex(r => r.id === id)
  if (index < 0 || !container.value) return
  container.value.scrollTop = Math.max(0, offsets.value[index] - viewportHeight.value / 2 + (heights.get(id) || 118) / 2)
  onScroll(); await nextTick()
  // Measure the newly rendered window, then refine centering after layout.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const el = elements.get(id)
  if (el) {
    const bounds = container.value.getBoundingClientRect(), r = el.getBoundingClientRect()
    container.value.scrollTop += r.top + r.height / 2 - bounds.top - bounds.height / 2
    onScroll()
    el.focus({ preventScroll: true })
  }
}
watch(() => e.seekVersion.value, () => nextTick(() => center(e.seekId.value)))
function outside(message) {
  return (e.start.value !== null && compareInstants(message.instant, e.start.value) < 0) || (e.end.value !== null && compareInstants(message.instant, e.end.value) > 0)
}
function context(id) {
  const el = elements.get(id), bounds = container.value.getBoundingClientRect()
  const offset = el?.getBoundingClientRect().top - bounds.top
  e.toggleContext(id)
  nextTick(() => {
    const index = rows.value.findIndex(r => r.id === id)
    if (index >= 0 && Number.isFinite(offset)) { container.value.scrollTop = offsets.value[index] - offset; onScroll() }
  })
}
onMounted(() => {
  observer = new ResizeObserver(entries => {
    const snapshot = topSnapshot()
    let changed = false
    entries.forEach(entry => {
      if (entry.target === container.value) { viewportHeight.value = entry.contentRect.height; return }
      const id = entry.target.dataset.messageId, height = entry.borderBoxSize?.[0]?.blockSize || entry.target.getBoundingClientRect().height
      if (id && Math.abs((heights.get(id) || 118) - height) > 0.5) { heights.set(id, height); changed = true }
    })
    if (changed) {
      revision.value++
      if (snapshot && !correcting) {
        const index = rows.value.findIndex(r => r.id === snapshot.id)
        if (index >= 0) { correcting = true; container.value.scrollTop = offsets.value[index] - snapshot.top; requestAnimationFrame(() => { correcting = false }) }
      }
    }
    onScroll()
  })
  observer.observe(container.value)
  elements.forEach(el => observer.observe(el))
  onScroll()
  if (e.seekId.value) center(e.seekId.value)
})
onBeforeUnmount(() => { observer?.disconnect(); cancelAnimationFrame(frame) })
defineExpose({ center })
</script>
<template>
  <div ref="container" class="message-scroll" @scroll.passive="onScroll" aria-label="Message results" tabindex="0" data-testid="message-scroll">
    <div v-if="!rows.length" class="empty-state"><v-icon size="40" color="secondary">mdi-text-search</v-icon><h3>No matching messages</h3><p>Adjust the channels, time range, or selected keywords.</p></div>
    <div :style="{ height: offsets[first] + 'px' }" aria-hidden="true"></div>
    <article v-for="row in windowRows" :key="row.id" :ref="el => register(row.id, el)" :data-message-id="row.id" :data-primary="row.primary" :data-anchor="row.anchor" tabindex="-1"
      class="message-row" :class="{ 'in-context': row.group, 'group-start': row.groupStart, 'group-end': row.groupEnd, 'context-only': !row.primary }"
      :style="{ '--channel-color': e.channelMap.value.get(e.messageMap.value.get(row.id).channelId).color }">
      <div class="context-line" v-if="row.group"></div>
      <div class="message-card">
        <div class="context-banner" v-if="row.groupStart"><v-icon size="13">mdi-forum-outline</v-icon> Conversation context <span>· {{ e.channelMap.value.get(e.messageMap.value.get(row.id).channelId).name }}</span></div>
        <div class="message-top">
          <time :datetime="e.messageMap.value.get(row.id).sentTime">{{ formatTime(e.messageMap.value.get(row.id).timestampMs, e.clock.value === 'utc' ? 0 : e.messageMap.value.get(row.id).offsetMinutes) }}</time>
          <span class="channel-tag">#{{ e.channelMap.value.get(e.messageMap.value.get(row.id).channelId).name }}</span>
          <span class="sender">{{ e.messageMap.value.get(row.id).sender }}</span>
          <div v-if="e.messageMap.value.get(row.id).subject" class="message-subject"><HighlightText :text="e.messageMap.value.get(row.id).subject" :keywords="e.selectedKeywords.value" /></div>
          <span v-if="!row.primary" class="context-label">context</span>
          <span v-if="outside(e.messageMap.value.get(row.id))" class="outside-label">outside interval</span>
          <v-btn v-if="row.primary" :variant="row.anchor ? 'tonal' : 'text'" size="x-small" :aria-label="`${row.anchor ? 'Close' : 'Open'} context for ${row.id}`" @click="context(row.id)" :prepend-icon="row.anchor ? 'mdi-close' : 'mdi-unfold-more-horizontal'">{{ row.anchor ? 'Close context' : 'Context' }}</v-btn>
        </div>
        <div class="message-body" v-if="e.messageMap.value.get(row.id).messageText"><HighlightText :text="e.messageMap.value.get(row.id).messageText" :keywords="e.selectedKeywords.value" /></div>
        <div class="empty-text" v-if="!e.messageMap.value.get(row.id).subject && !e.messageMap.value.get(row.id).messageText">No subject or message text</div>
      </div>
    </article>
    <div :style="{ height: Math.max(0, offsets.at(-1) - offsets[last]) + 'px' }" aria-hidden="true"></div>
  </div>
</template>
