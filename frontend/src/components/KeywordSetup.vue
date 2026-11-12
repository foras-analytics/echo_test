<script setup>
import { computed, ref } from 'vue'
const props = defineProps({ echo: Object }); const e = props.echo
const term = ref(''), groupName = ref(''), deleteId = ref(null)
const subset = computed(() => e.suggestions.value)
const maxCount = computed(() => Math.log1p(subset.value[0]?.count || 1))
const minCount = computed(() => Math.log1p(subset.value.at(-1)?.count || 1))
function wordSize(count) {
  const span = maxCount.value - minCount.value
  return 14 + (span ? 10 * (Math.log1p(count) - minCount.value) / span : 0)
}
const saved = computed(() => new Set(e.keywords.value.map(k => k.text.toLowerCase())))
function toggleSuggestion(s) {
  const keyword = e.keywords.value.find(k => k.text.toLowerCase() === s.text)
  if (keyword) e.removeKeyword(keyword.id)
  else e.addKeyword(s.text)
}
function add() { if (e.addKeyword(term.value)) term.value = '' }
function createGroup() { e.addGroup(groupName.value); groupName.value = '' }
</script>
<template>
  <div class="page keyword-page">
    <div class="page-heading"><h1>Keyword setup</h1></div>
    <div class="keyword-workspace">
      <section class="panel suggestions-panel"><div class="section-heading"><h2>Suggested words</h2><span class="muted">Full archive · Latin stop words · {{ subset.length }} terms</span></div>
        <v-progress-linear v-if="e.suggestionStatus.value === 'pending'" indeterminate color="primary"></v-progress-linear>
        <div v-if="e.suggestionStatus.value === 'pending'" class="loading-note">Finding words… Message browsing is available.</div>
        <v-alert v-if="e.suggestionStatus.value === 'error'" type="warning" variant="tonal">{{ e.suggestionError.value }}</v-alert>
        <div v-if="e.suggestionStatus.value === 'ready' && !subset.length" class="empty-note">No candidate words in this archive.</div>
        <div class="suggestions-views">
          <ol class="ranked-list" aria-label="Ranked keyword suggestions"><li v-for="(s, i) in subset" :key="s.text"><button @click="toggleSuggestion(s)" :class="{ 'suggestion-selected': saved.has(s.text), saved: saved.has(s.text) }" :aria-pressed="saved.has(s.text)"><span class="rank">{{ String(i + 1).padStart(2, '0') }}</span><span class="suggestion-word">{{ s.text }}</span><v-icon size="13" v-if="saved.has(s.text)" aria-label="Saved">mdi-check</v-icon><span class="suggestion-count">{{ s.count.toLocaleString() }}</span></button></li></ol>
          <div class="word-cloud" aria-label="Word cloud"><button v-for="(s, i) in subset" :key="s.text" @click="toggleSuggestion(s)" :class="{ 'cloud-selected': saved.has(s.text), saved: saved.has(s.text) }" :aria-pressed="saved.has(s.text)" :style="{ fontSize: wordSize(s.count) + 'px', color: `rgb(var(--v-theme-cloud-${i % 4}))` }" >{{ s.text }}</button></div>
        </div>
        <div class="panel-footnote">Literal substring matches · Click a word to add or remove it.</div>
      </section>
      <aside class="panel keyword-pool"><div class="section-heading"><h2>Saved keywords</h2><span class="count-badge">{{ e.keywords.value.length }}</span></div>
        <form @submit.prevent="add" class="inline-form"><v-text-field v-model="term" label="Word or literal phrase" maxlength="300"/><v-btn type="submit" icon="mdi-plus" color="primary" aria-label="Save keyword" :disabled="!term.trim()" /></form>
        <p class="empty-note" v-if="!e.keywords.value.length">Your saved terms will appear here.</p>
        <div class="saved-keywords">
          <div v-for="k in e.sortedKeywords.value" :key="k.id" class="saved-keyword">
            <span class="keyword-dot" :style="{ background: k.color }"></span>
            <span class="keyword-name">{{ k.text }}</span>
            <v-select :model-value="k.groupId" @update:model-value="k.groupId = $event" :items="[{ title: 'Ungrouped', value: null }, ...e.groups.value.map(g => ({ title: g.name, value: g.id }))]" :aria-label="`Move ${k.text} to group`" class="group-select" :style="{ '--group-label-width': Math.max(10, (e.groups.value.find(g => g.id === k.groupId)?.name || 'Ungrouped').length + 5) + 'ch' }" /><v-btn variant="text" icon="mdi-close" size="x-small" :aria-label="`Delete keyword ${k.text}`" @click="e.removeKeyword(k.id)"/>
          </div>
        </div>
        <div class="groups-heading"><h2>Groups</h2></div>
        <form @submit.prevent="createGroup" class="inline-form"><v-text-field v-model="groupName" label="New group name" maxlength="100"/><v-btn type="submit" icon="mdi-plus" variant="tonal" aria-label="Create group" :disabled="!groupName.trim()"/></form>
        <div v-for="g in e.groups.value" :key="g.id" class="group-item">
          <div class="group-top"><v-text-field v-model="g.name" :aria-label="`Group name ${g.id}`" @blur="g.name = g.name.trim() || 'Untitled group'"/><span class="count-badge">{{ e.keywords.value.filter(k => k.groupId === g.id).length }}</span><v-btn variant="text" size="small" @click="deleteId = deleteId === g.id ? null : g.id" :aria-expanded="deleteId === g.id" :aria-label="`Delete group ${g.name}`">Delete</v-btn></div>
          <div v-if="deleteId === g.id" class="delete-popover"><p>Delete “{{ g.name }}”?</p><v-btn block variant="tonal" @click="e.deleteGroup(g.id, false); deleteId = null">Keep keywords ungrouped</v-btn><v-btn block color="error" variant="text" @click="e.deleteGroup(g.id, true); deleteId = null">Delete group and keywords</v-btn><v-btn block variant="text" @click="deleteId = null">Cancel</v-btn></div>
        </div>
      </aside>
    </div>
  </div>
</template>
