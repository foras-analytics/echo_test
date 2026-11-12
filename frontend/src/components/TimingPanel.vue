<script setup>
import { computed, ref, watch } from 'vue'
import { duration, formatTime } from '../model.js'
const props = defineProps({ echo: Object }); const e = props.echo
const keywordId = ref(null), page = ref(1)
const series = computed(() => e.queryResult.value.timing.find(s => s.keywordId === keywordId.value))
const selected = computed(() => e.selectedKeywords.value.find(k => k.id === keywordId.value))
const rows = computed(() => (series.value?.occurrences || []).slice((page.value - 1) * 40, page.value * 40))
watch(() => e.queryResult.value.timing, values => {
  if (!values.some(v => v.keywordId === keywordId.value)) keywordId.value = values[0]?.keywordId ?? null
  page.value = 1
}, { immediate: true })
watch(keywordId, () => { page.value = 1 })
function time(id) { const m = e.messageMap.value.get(id); return formatTime(m.timestampMs, e.clock.value === 'utc' ? 0 : m.offsetMinutes) }
</script>
<template>
  <aside class="timing-panel" aria-label="Keyword timing analysis">
    <div class="section-heading"><h2>Keyword timing</h2><slot></slot></div>
    <p class="empty-note" v-if="!e.selectedKeywords.value.length">Select one or more keywords to compare occurrences.</p>
    <template v-else>
      <v-select v-model="keywordId" :items="e.selectedKeywords.value.map(k => ({ title: k.text, value: k.id }))" label="Analysis keyword"/>
      <div class="timing-summary" :style="{ borderLeftColor: selected?.color }"><strong>{{ series?.count || 0 }}</strong> matching messages</div>
      <h3>First observed by channel</h3><p class="tiny-note">Delay from the earliest mention within the active filters.</p>
      <div class="first-mentions"><button v-for="first in series?.firstMentions || []" :key="first.channelId" @click="e.seek(first.messageId, true)"><span :style="{ color: e.channelMap.value.get(first.channelId).color }">#{{ e.channelMap.value.get(first.channelId).name }}</span><strong>+{{ duration(first.delaySeconds) }}</strong></button></div>
      <h3>Occurrences</h3>
      <div class="timing-table-wrap"><table class="timing-table"><thead><tr><th>Message</th><th>Gap in channel</th><th>First delay</th></tr></thead><tbody><tr v-for="row in rows" :key="row.messageId"><td><button @click="e.seek(row.messageId, true)" :aria-label="`Open occurrence ${row.messageId} in context`"><time class="occurrence-time" :datetime="e.messageMap.value.get(row.messageId).sentTime"><span>{{ time(row.messageId).slice(0, 10) }}</span><span>{{ time(row.messageId).slice(11) }}</span></time><span :style="{ color: e.channelMap.value.get(row.channelId).color }">#{{ e.channelMap.value.get(row.channelId).name }}</span><span class="occurrence-sender">{{ e.messageMap.value.get(row.messageId).sender }}</span></button></td><td>{{ duration(row.gapSeconds) }}</td><td>{{ duration(row.firstDelaySeconds) }}</td></tr></tbody></table></div>
      <v-pagination v-if="series?.count > 40" v-model="page" :length="Math.ceil(series.count / 40)" :total-visible="3" density="compact" size="small"/>
      <p v-if="!series?.count" class="empty-note">No occurrences in this interval.</p>
    </template>
  </aside>
</template>
