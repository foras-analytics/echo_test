<script setup>
import { computed, ref } from 'vue'
import { arc, chord, ribbon } from 'd3'
const props = defineProps({ channels: Array, matrix: Array })
const hover = ref(null)
const layout = computed(() => {
  // Give isolated channels a small arc solely for layout; diagonal ribbons are omitted.
  const matrix = props.matrix.map(row => [...row])
  matrix.forEach((row, i) => { if (!row.some(Boolean)) row[i] = Math.max(1, Math.max(...matrix.flat(), 1) * 0.06) })
  return chord().padAngle(0.045).sortSubgroups((a, b) => b - a)(matrix)
})
const ring = arc().innerRadius(190).outerRadius(203)
const link = ribbon().radius(189)
const links = computed(() => layout.value.filter(d => d.source.index !== d.target.index))
function label(group) {
  const angle = (group.startAngle + group.endAngle) / 2
  return { transform: `rotate(${angle * 180 / Math.PI - 90}) translate(218) ${angle > Math.PI ? 'rotate(180)' : ''}`, anchor: angle > Math.PI ? 'end' : 'start' }
}
</script>
<template>
  <div class="chord-wrap">
    <svg viewBox="-320 -285 640 570" class="chord" role="img" aria-label="Channel participation overlap chord diagram">
      <g v-for="d in links" :key="d.source.index + '-' + d.target.index">
        <path :d="link(d)" :fill="channels[d.source.index].color" :opacity="hover === null || hover === d.source.index || hover === d.target.index ? 0.36 : 0.04" class="ribbon" tabindex="0" :aria-label="`${channels[d.source.index].name} and ${channels[d.target.index].name}: ${d.source.value} shared senders`"></path>
      </g>
      <g v-for="group in layout.groups" :key="group.index" @mouseenter="hover = group.index" @mouseleave="hover = null" @focusin="hover = group.index" @focusout="hover = null">
        <path :d="ring(group)" :fill="channels[group.index].color" tabindex="0" :aria-label="`${channels[group.index].name}: ${channels[group.index].users} participants`"></path>
        <text :transform="label(group).transform" :text-anchor="label(group).anchor" dominant-baseline="middle" :fill="channels[group.index].color">{{ channels[group.index].name.length > 18 ? channels[group.index].name.slice(0, 17) + '…' : channels[group.index].name }}</text>
      </g>
      <text text-anchor="middle" y="-7" class="chord-center">SHARED</text><text text-anchor="middle" y="14" class="chord-center">PARTICIPANTS</text>
    </svg>
    <p class="chart-caption">Shared senders per channel pair</p>
  </div>
</template>
