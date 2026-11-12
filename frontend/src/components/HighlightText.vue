<script setup>
import { computed } from 'vue'
import { highlightedParts } from '../model.js'
const props = defineProps({ text: { type: String, default: '' }, keywords: { type: Array, default: () => [] } })
const parts = computed(() => highlightedParts(props.text, props.keywords))
function style(part) {
  if (!part.keywords.length) return {}
  const colors = [...new Set(part.keywords.map(k => k.color))]
  return { background: colors.length === 1 ? `${colors[0]}22` : `linear-gradient(180deg, ${colors.map((c, i) => `${c}30 ${i * 100 / colors.length}% ${(i + 1) * 100 / colors.length}%`).join(',')})`, borderBottom: `2px solid ${colors[0]}` }
}
</script>
<template><template v-for="(part, i) in parts" :key="i"><mark v-if="part.keywords.length" :style="style(part)">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></template>
