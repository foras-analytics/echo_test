<script setup>
import { computed, ref } from 'vue'
import ChordDiagram from './ChordDiagram.vue'
import { duration, formatTime } from '../model.js'
const props = defineProps({ echo: Object }); const e = props.echo
const data = computed(() => e.archive.value), stats = computed(() => data.value.summary)
const issuesOpen = ref(false)
function timestamp(message) { return message ? formatTime(message.timestampMs, e.clock.value === 'utc' ? 0 : message.offsetMinutes) : '—' }
const pairs = computed(() => {
  const result = []
  data.value.channels.forEach((a, i) => data.value.channels.slice(i + 1).forEach((b, j) => {
    const count = data.value.relationships[i][j + i + 1]
    if (count) result.push({ a, b, count })
  }))
  return result.sort((a, b) => b.count - a.count)
})
</script>
<template>
  <div class="page overview-page">
    <div class="page-heading"><div><h1>Overview</h1><p class="archive-filename"><v-icon size="16">mdi-file-document-outline</v-icon>{{ data.filename }}<span class="session-pill">LOCAL SESSION</span></p></div><div class="heading-actions"><v-btn variant="outlined" @click="e.screen.value = 'keywords'">Set up keywords</v-btn><v-btn color="primary" append-icon="mdi-arrow-right" @click="e.screen.value = 'explorer'">Explore messages</v-btn></div></div>
    <div class="stat-grid"><div class="stat-card"><span>Messages</span><strong>{{ stats.messages.toLocaleString() }}</strong><small>successfully imported</small></div><div class="stat-card"><span>Channels</span><strong>{{ stats.channels.toLocaleString() }}</strong><small>including empty channels</small></div><div class="stat-card"><span>Participants</span><strong>{{ stats.users.toLocaleString() }}</strong><small>distinct sender addresses</small></div><div class="stat-card"><span>Archive span</span><strong>{{ duration(stats.spanSeconds) }}</strong><small>elapsed time between bounds</small></div></div>
    <div class="archive-bounds"><span><span class="muted">FIRST MESSAGE</span>{{ timestamp(stats.first) }}</span><span><span class="muted">LAST MESSAGE</span>{{ timestamp(stats.last) }}</span></div>
    <section class="import-report" :class="{ 'has-issues': data.issues.length }"><button class="report-toggle" @click="issuesOpen = !issuesOpen" :aria-expanded="issuesOpen"><v-icon size="18">{{ data.issues.length ? 'mdi-alert-circle-outline' : 'mdi-check-circle-outline' }}</v-icon><strong>{{ data.issues.length ? `${data.issues.length} import issue${data.issues.length === 1 ? '' : 's'}` : 'Archive imported without issues' }}</strong><span v-if="data.issues.length">{{ stats.skippedRecords }} skipped records · {{ data.issues.length - stats.skippedRecords }} warnings</span><v-icon class="ml-auto" size="18">{{ issuesOpen ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon></button><div v-if="issuesOpen" class="issue-list"><p v-if="!data.issues.length">All channel and message records were accepted.</p><table v-else><thead><tr><th>Record location</th><th>Problem</th></tr></thead><tbody><tr v-for="(issue, i) in data.issues" :key="i"><td><code>{{ issue.location }}</code></td><td>{{ issue.reason }}</td></tr></tbody></table></div></section>
    <div class="overview-grid"><section class="panel relationship-panel"><div class="section-heading"><div><h2>Channel relationships</h2></div><span class="subtle-label">ALL CHANNELS</span></div><ChordDiagram v-if="data.channels.length" :channels="e.displayChannels.value" :matrix="data.relationships"/><p v-else class="empty-note">No valid channels were imported.</p><details v-if="pairs.length" class="relationship-details"><summary>Inspect all {{ pairs.length }} connected channel pairs</summary><div class="pair-list"><div v-for="pair in pairs" :key="pair.a.id + pair.b.id"><span>{{ pair.a.name }} ↔ {{ pair.b.name }}</span><strong>{{ pair.count }}</strong></div></div></details></section><section class="panel channel-summary"><div class="section-heading"><h2>Channels</h2><span class="muted">{{ data.channels.length }} total</span></div><table><thead><tr><th>Channel</th><th>Messages</th><th>Users</th></tr></thead><tbody><tr v-for="c in e.displayChannels.value" :key="c.id"><td><span class="channel-swatch" :style="{ background: c.color }"></span><span>{{ c.name }}</span><small v-if="data.channels.filter(x => x.name === c.name).length > 1"> ({{ c.id }})</small></td><td>{{ c.messages.toLocaleString() }}</td><td>{{ c.users }}</td></tr></tbody></table></section></div>
  </div>
</template>
