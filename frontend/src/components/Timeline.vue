<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { nearestMessage, offsetLabel } from '../model.js'
const props = defineProps({ echo: Object })
const e = props.echo
const canvas = ref(null), plot = ref(null), width = ref(700)
const laneHeight = 24
const start = computed(() => Number(e.start.value) * 1000)
const end = computed(() => Number(e.end.value) * 1000)
const valid = computed(() => e.archive.value?.summary.first && !e.rangeError.value)
const plotHeight = computed(() => Math.max(1, e.lanes.value.length) * laneHeight)
const axis = computed(() => valid.value ? Array.from({ length: 6 }, (_, i) => {
  const ms = start.value + (end.value - start.value) * i / 5
  const span = end.value - start.value
  const iso = new Date(ms + e.sharedOffset.value * 60000).toISOString()
  return { ratio: i / 5, label: span > 2 * 86400000 ? iso.slice(5, 10) : span > 60000 ? iso.slice(5, 10) + ' ' + iso.slice(11, 16) : iso.slice(11, 23) }
}) : [])
function x(ms) { return end.value === start.value ? width.value / 2 : (ms - start.value) / (end.value - start.value) * width.value }
function instant(event) {
  const rect = canvas.value.getBoundingClientRect()
  return start.value + Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * (end.value - start.value)
}
function draw() {
  if (!canvas.value) return
  const style = getComputedStyle(canvas.value)
  const token = name => style.getPropertyValue('--' + name).trim()
  const ratio = window.devicePixelRatio || 1
  canvas.value.width = Math.round(width.value * ratio); canvas.value.height = Math.round(plotHeight.value * ratio)
  const ctx = canvas.value.getContext('2d')
  ctx.scale(ratio, ratio)
  ctx.clearRect(0, 0, width.value, plotHeight.value)
  const laneIndex = new Map()
  e.lanes.value.forEach((lane, i) => lane.members.forEach(cid => laneIndex.set(cid, i)))
  e.lanes.value.forEach((_, i) => {
    if (i % 2 === 0) { ctx.fillStyle = token('lane-alt'); ctx.fillRect(0, i * laneHeight, width.value, laneHeight) }
  })
  if (!valid.value) return
  axis.value.forEach(t => { ctx.strokeStyle = token('line'); ctx.beginPath(); ctx.moveTo(t.ratio * width.value, 0); ctx.lineTo(t.ratio * width.value, plotHeight.value); ctx.stroke() })
  if (e.visibleSpan.value) {
    const [a, b] = e.visibleSpan.value
    const xmin = x(a), xmax = x(b)
    ctx.fillStyle = token('viewport-fill'); ctx.fillRect(xmin - (a === b ? 2 : 0), 0, Math.max(4, xmax - xmin), plotHeight.value)
    ctx.strokeStyle = token('viewport-stroke'); ctx.strokeRect(xmin - (a === b ? 2 : 0), 0, Math.max(4, xmax - xmin), plotHeight.value)
  }
  const colors = new Map(e.selectedKeywords.value.map(k => [k.id, k.color]))
  e.baseMessages.value.forEach(m => {
    const lane = laneIndex.get(m.channelId)
    if (lane === undefined) return
    const hits = e.queryResult.value.matches[m.id] || []
    const tickColors = hits.length ? hits.map(id => colors.get(id)) : [e.channelMap.value.get(m.channelId)?.color || '#777']
    const px = Math.max(0, Math.min(width.value - 1, x(m.timestampMs)))
    const y = lane * laneHeight + 5
    tickColors.forEach((color, j) => { ctx.fillStyle = color; ctx.globalAlpha = 0.95; ctx.fillRect(px, y + j * 14 / tickColors.length, 1.5, 14 / tickColors.length) })
  })
  ctx.globalAlpha = 1
}
function click(event) {
  if (!valid.value) return
  const m = nearestMessage(e.baseMessages.value, instant(event))
  if (m) e.seek(m.id)
}
let observer
watch(plot, (element, previous) => { if (previous) observer?.unobserve(previous); if (element) { observer?.observe(element); nextTick(draw) } })
watch([() => e.baseMessages.value, () => e.lanes.value, () => e.visibleSpan.value, () => e.selectedKeywords.value, start, end, () => e.sharedOffset.value, () => e.dark.value, width], () => nextTick(draw), { deep: true })
onMounted(() => { observer = new ResizeObserver(entries => { width.value = entries[0].contentRect.width; draw() }); if (plot.value) observer.observe(plot.value); draw() })
onBeforeUnmount(() => observer?.disconnect())
</script>
<template>
  <section class="timeline-panel" aria-label="Synchronized message timeline" :style="{ height: valid ? 'auto' : '100px' }" :data-visible-start="e.visibleSpan.value?.[0]" :data-visible-end="e.visibleSpan.value?.[1]">
    <div class="timeline-toolbar"><strong>Activity</strong><span>{{ e.baseMessages.value.length.toLocaleString() }} messages</span><span class="tiny-divider"></span><span>{{ offsetLabel(e.sharedOffset.value) }}</span><span class="viewport-key"><i></i> in view</span><span class="timeline-hint">Click to seek</span></div>
    <div v-if="!valid" class="timeline-empty">{{ e.rangeError.value || 'No message bounds available' }}</div>
    <template v-else>
      <div class="timeline-axis"><div class="axis-label">CHANNEL</div><div class="axis-ticks"><span v-for="t in axis" :key="t.ratio" :style="{ left: t.ratio * 100 + '%', transform: t.ratio === 0 ? 'none' : t.ratio === 1 ? 'translateX(-100%)' : 'translateX(-50%)' }">{{ t.label }}</span></div></div>
      <div class="timeline-scroll">
        <div class="lane-labels"><div v-for="lane in e.lanes.value" :key="lane.id" class="lane-label" :style="{ height: laneHeight + 'px', color: lane.id === 'other' ? 'var(--muted)' : e.channelMap.value.get(lane.id).color }">{{ lane.id === 'other' ? 'Other channels' : '#' + e.channelMap.value.get(lane.id).name }}</div></div>
        <div ref="plot" class="timeline-plot" :style="{ height: plotHeight + 'px' }"><canvas ref="canvas" :style="{ width: '100%', height: plotHeight + 'px' }" role="img" :aria-label="`Timeline of ${e.baseMessages.value.length} matching messages; click to seek`" @click="click"></canvas><div v-if="!e.baseMessages.value.length" class="no-ticks">No matching activity</div></div>
      </div>
    </template>
  </section>
</template>
