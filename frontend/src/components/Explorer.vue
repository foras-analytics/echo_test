<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import VirtualMessages from './VirtualMessages.vue'
import Timeline from './Timeline.vue'
import TimingPanel from './TimingPanel.vue'
import { inputTime, inputToInstant, offsetLabel } from '../model.js'
const props = defineProps({ echo: Object }); const e = props.echo
const timing = ref(false), startDraft = ref(''), endDraft = ref(''), timeError = ref(''), drag = ref(null)
const list = ref(null), channelOrder = ref(null)
let pendingDrag = null, scrollFrame = null, suppressClick = false
watch([() => e.start.value, () => e.end.value, () => e.sharedOffset.value], () => {
  startDraft.value = e.start.value === null ? '' : inputTime(Number(e.start.value) * 1000, e.sharedOffset.value)
  endDraft.value = e.end.value === null ? '' : inputTime(Number(e.end.value) * 1000, e.sharedOffset.value)
  timeError.value = ''
}, { immediate: true })
function setTime(which, value) {
  if (!value || !Number.isFinite(Date.parse(value + 'Z'))) { timeError.value = 'Enter a valid start and end date and time.'; return }
  timeError.value = ''
  e[which].value = inputToInstant(value, e.sharedOffset.value)
}
function toggleChannel(id) {
  e.selectedChannels.value = e.selectedChannels.value.includes(id) ? e.selectedChannels.value.filter(cid => cid !== id) : [...e.selectedChannels.value, id]
}
function move(id, step) {
  const next = [...e.order.value], i = next.indexOf(id), to = i + step
  if (to < 0 || to >= next.length) return
  next.splice(i, 1); next.splice(to, 0, id); e.order.value = next
}
const channelEntries = computed(() => {
  const items = e.order.value.map(id => ({ key: id, id }))
  items.splice(e.divider.value, 0, { key: 'divider' })
  return items
})
function beginDrag(event, item) {
  if (event.button !== 0 || event.target.closest('input, button')) return
  pendingDrag = { key: item.key, order: [...e.order.value], divider: e.divider.value, x: event.clientX, y: event.clientY, pointerId: event.pointerId }
}
function insideList(x, y) {
  const bounds = channelOrder.value.getBoundingClientRect()
  const panel = channelOrder.value.closest('.filter-panel').getBoundingClientRect()
  return x >= bounds.left && x <= bounds.right && y >= Math.max(bounds.top, panel.top) && y <= Math.min(bounds.bottom, panel.bottom)
}
function previewPlacement(item, element, y) {
  if (!drag.value || item === drag.value.key) return
  const bounds = element.getBoundingClientRect()
  const after = y > bounds.top + bounds.height / 2
  const index = item === 'divider' ? e.divider.value : e.order.value.indexOf(item)
  if (drag.value.key === 'divider') {
    if (item !== 'divider') e.divider.value = index + (after ? 1 : 0)
  } else {
    const from = e.order.value.indexOf(drag.value.key)
    const slot = index + (item !== 'divider' && after ? 1 : 0)
    const to = slot > from ? slot - 1 : slot
    if (to === from) return
    if (item !== 'divider' && ((from < index && !after) || (from > index && after))) return
    const next = [...e.order.value]
    next.splice(from, 1); next.splice(to, 0, drag.value.key)
    e.order.value = next
  }
}
function previewAtPointer() {
  if (!drag.value) return
  const { x, y } = drag.value
  drag.value.inside = insideList(x, y)
  if (!drag.value.inside) return
  const target = document.elementFromPoint(x, y)
  const entry = target?.closest('[data-channel-entry]')
  if (entry && channelOrder.value.contains(entry)) previewPlacement(entry.dataset.channelEntry, entry, y)
  else if (target?.closest('.channel-drop-end')) {
    if (drag.value.key === 'divider') e.divider.value = e.order.value.length
    else e.order.value = [...e.order.value.filter(id => id !== drag.value.key), drag.value.key]
  }
}
function scrollWhileDragging() {
  if (!drag.value) return
  const panel = channelOrder.value.closest('.filter-panel'), bounds = panel.getBoundingClientRect()
  if (drag.value.x >= bounds.left && drag.value.x <= bounds.right) {
    const delta = drag.value.y < bounds.top + 32 ? -8 : drag.value.y > bounds.bottom - 32 ? 8 : 0
    if (delta) { panel.scrollTop += delta; previewAtPointer() }
  }
  scrollFrame = requestAnimationFrame(scrollWhileDragging)
}
function moveDrag(event) {
  if (!pendingDrag) return
  if (!drag.value) {
    if (Math.hypot(event.clientX - pendingDrag.x, event.clientY - pendingDrag.y) < 5) return
    channelOrder.value.setPointerCapture(event.pointerId)
    drag.value = { ...pendingDrag, inside: true }
    scrollFrame = requestAnimationFrame(scrollWhileDragging)
  }
  event.preventDefault()
  drag.value.x = event.clientX; drag.value.y = event.clientY
  previewAtPointer()
}
function endDrag(event, cancel = false) {
  const active = drag.value
  if (active) {
    if (cancel || !insideList(event?.clientX ?? active.x, event?.clientY ?? active.y)) {
      e.order.value = active.order
      e.divider.value = active.divider
    }
    suppressClick = true
    setTimeout(() => { suppressClick = false }, 0)
  }
  cancelAnimationFrame(scrollFrame)
  if (pendingDrag && channelOrder.value?.hasPointerCapture(pendingDrag.pointerId)) channelOrder.value.releasePointerCapture(pendingDrag.pointerId)
  pendingDrag = null
  drag.value = null
}
function suppressDragClick(event) {
  if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false }
}
function cancelOnEscape(event) {
  if (event.key === 'Escape' && pendingDrag) { event.preventDefault(); endDrag(null, true) }
}
function releasePendingClick(event) { if (pendingDrag && !drag.value) endDrag(event) }
onMounted(() => { window.addEventListener('keydown', cancelOnEscape); window.addEventListener('pointerup', releasePendingClick) })
onBeforeUnmount(() => { cancelAnimationFrame(scrollFrame); window.removeEventListener('keydown', cancelOnEscape); window.removeEventListener('pointerup', releasePendingClick) })
function navigate(step) {
  const ids = e.queryResult.value.ids
  if (!ids.length) return
  const visiblePrimary = e.visibleIds.value.filter(id => ids.includes(id))
  const current = e.seekId.value && e.visibleIds.value.includes(e.seekId.value) ? e.seekId.value : visiblePrimary[0]
  const at = ids.indexOf(current)
  e.seek(ids[Math.max(0, Math.min(ids.length - 1, at + step))])
}
const allSelected = computed(() => e.selectedChannels.value.length === e.order.value.length)
function selectAll() { e.selectedChannels.value = allSelected.value ? [] : [...e.order.value] }
</script>
<template>
  <div class="explorer-shell">
    <aside class="filter-panel" aria-label="Explorer filters">
      <div class="filter-heading"><span class="eyebrow">FILTERS</span><v-btn variant="text" size="x-small" @click="e.selectedChannels.value = [...e.order.value]; e.activeIds.value = []; e.resetRange()">Clear all</v-btn></div>
      <section class="filter-section time-filters"><div class="filter-section-title"><button class="filter-collapse" @click="e.showTime.value = !e.showTime.value" :aria-expanded="e.showTime.value"><v-icon size="17">{{ e.showTime.value ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon><h2>Time interval</h2></button><span>{{ offsetLabel(e.sharedOffset.value) }}</span></div>
        <template v-if="e.showTime.value">
        <label for="start-time">Start, inclusive</label><input id="start-time" type="datetime-local" step="0.001" v-model="startDraft" @change="setTime('start', startDraft)" :disabled="!e.archive.value.summary.first">
        <label for="end-time">End, inclusive</label><input id="end-time" type="datetime-local" step="0.001" v-model="endDraft" @change="setTime('end', endDraft)" :disabled="!e.archive.value.summary.first">
        <p v-if="timeError || e.rangeError.value" class="field-error" role="alert">{{ timeError || e.rangeError.value }}</p>
        <v-btn variant="text" prepend-icon="mdi-arrow-expand-horizontal" size="x-small" @click="e.resetRange()" :disabled="!e.archive.value.summary.first">Reset time range</v-btn>
        </template>
      </section>
      <section class="filter-section keyword-filters"><div class="filter-section-title"><button class="filter-collapse" @click="e.showKeywords.value = !e.showKeywords.value" :aria-expanded="e.showKeywords.value"><v-icon size="17">{{ e.showKeywords.value ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon><h2>Keywords</h2><span>{{ e.activeIds.value.length }}/{{ e.keywords.value.length }}</span></button><v-btn variant="text" icon="mdi-tune-variant" size="x-small" aria-label="Set up keywords" @click="e.screen.value = 'keywords'"/></div>
        <template v-if="e.showKeywords.value">
        <p v-if="!e.keywords.value.length" class="tiny-note">Save words in Keyword setup to filter here.</p>
        <div v-if="e.groups.value.length" class="group-filters"><button v-for="g in e.groups.value" :key="g.id" class="group-filter" :disabled="!e.keywords.value.some(k => k.groupId === g.id)" @click="e.toggleGroup(g.id)" :aria-pressed="e.keywords.value.filter(k => k.groupId === g.id).length > 0 && e.keywords.value.filter(k => k.groupId === g.id).every(k => e.activeIds.value.includes(k.id))"><v-icon size="13">mdi-folder-outline</v-icon>{{ g.name }}</button></div>
        <div class="keyword-chips"><button v-for="k in e.sortedKeywords.value" :key="k.id" class="keyword-chip" :class="{ active: e.activeIds.value.includes(k.id) }" :style="{ '--keyword-color': k.color }" :aria-pressed="e.activeIds.value.includes(k.id)" @click="e.toggleKeyword(k.id)"><span class="keyword-dot" :style="{ background: k.color }"></span>{{ k.text }}</button></div>
        <v-btn v-if="e.activeIds.value.length" variant="text" size="x-small" @click="e.activeIds.value = []">Clear keyword selection</v-btn>
        </template>
      </section>
      <section class="filter-section channel-filters"><div class="filter-section-title"><button class="channel-collapse" @click="e.showChannels.value = !e.showChannels.value" :aria-expanded="e.showChannels.value"><v-icon size="17">{{ e.showChannels.value ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon><h2>Channels</h2><span>{{ e.selectedChannels.value.length }}/{{ e.order.value.length }}</span></button><v-btn variant="text" size="x-small" @click="selectAll">{{ allSelected ? 'None' : 'All' }}</v-btn></div>
        <template v-if="e.showChannels.value">
          <div class="lane-count"><label for="lane-divider">Individual lanes</label><input id="lane-divider" type="number" :min="0" :max="e.order.value.length" :value="e.divider.value" @input="e.divider.value = Math.max(0, Math.min(e.order.value.length, Math.floor(Number($event.target.value))))" /></div>
          <div ref="channelOrder" class="channel-order" :class="{ 'sorting-active': drag }" aria-label="Reorder channels and timeline divider" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag($event, true)" @click.capture="suppressDragClick">
            <TransitionGroup name="channel-sort" tag="div">
              <div v-for="entry in channelEntries" :key="entry.key" class="channel-entry" :class="{ 'dragging-entry': drag?.key === entry.key }" :data-channel-entry="entry.key" @pointerdown="beginDrag($event, entry)" @dragstart.prevent>
                <div v-if="entry.key === 'divider'" class="lane-divider"><v-icon size="16">mdi-drag-horizontal</v-icon><span>Other channels below</span></div>
                <div v-else class="channel-control" :class="{ deselected: !e.selectedChannels.value.includes(entry.id) }">
                  <v-icon class="drag-handle" size="18">mdi-drag-vertical</v-icon><label><input type="checkbox" :checked="e.selectedChannels.value.includes(entry.id)" @change="toggleChannel(entry.id)" :aria-label="`Channel ${e.channelMap.value.get(entry.id).name}`"><i :style="{ background: e.channelMap.value.get(entry.id).color }"></i><span>{{ e.channelMap.value.get(entry.id).name }}</span></label><div class="channel-move"><button @click="move(entry.id, -1)" :disabled="e.order.value.indexOf(entry.id) === 0" :aria-label="`Move ${e.channelMap.value.get(entry.id).name} up`"><v-icon size="14">mdi-chevron-up</v-icon></button><button @click="move(entry.id, 1)" :disabled="e.order.value.indexOf(entry.id) === e.order.value.length - 1" :aria-label="`Move ${e.channelMap.value.get(entry.id).name} down`"><v-icon size="14">mdi-chevron-down</v-icon></button></div>
                </div>
              </div>
            </TransitionGroup>
            <div class="channel-drop-end"></div>
            <div v-if="drag" class="drag-preview" :class="{ 'outside-list': !drag.inside }" :style="{ left: (drag.x + 16) + 'px', top: (drag.y + 10) + 'px' }" aria-hidden="true">{{ drag.key === 'divider' ? 'Other channels below' : e.channelMap.value.get(drag.key).name }}</div>
          </div>
        </template>
      </section>
    </aside>
    <main class="explorer-main">
      <div class="results-toolbar"><div><strong>{{ e.queryResult.value.ids.length.toLocaleString() }}</strong><span> messages</span><v-progress-circular v-if="e.querying.value" indeterminate size="14" width="2" color="primary" class="ml-2"/></div><span v-if="e.anchors.value.size" class="context-counter">{{ e.anchors.value.size }} open context{{ e.anchors.value.size > 1 ? 's' : '' }}</span><div class="results-actions"><v-btn variant="text" icon="mdi-chevron-up" size="x-small" aria-label="Previous match" @click="navigate(-1)" :disabled="!e.queryResult.value.ids.length"/><v-btn variant="text" icon="mdi-chevron-down" size="x-small" aria-label="Next match" @click="navigate(1)" :disabled="!e.queryResult.value.ids.length"/><v-btn variant="text" size="small" v-if="e.anchors.value.size" @click="e.anchors.value = new Set()">Close all contexts</v-btn><v-btn :variant="timing ? 'tonal' : 'text'" size="small" prepend-icon="mdi-chart-timeline-variant" @click="timing = !timing" :aria-expanded="timing">Timing</v-btn></div></div>
      <div class="reading-area"><VirtualMessages ref="list" :echo="e"/><TimingPanel v-if="timing" :echo="e"><v-btn icon="mdi-close" size="x-small" variant="text" aria-label="Close timing panel" @click="timing = false"/></TimingPanel></div>
      <Timeline :echo="e"/>
    </main>
  </div>
</template>
