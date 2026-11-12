<script setup>
import { computed, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { createEcho } from './store.js'
import Overview from './components/Overview.vue'
import KeywordSetup from './components/KeywordSetup.vue'
import Explorer from './components/Explorer.vue'
const e = createEcho()
const theme = useTheme()
const isDark = computed(() => theme.global.current.value.dark)
watch(isDark, value => { e.dark.value = value }, { immediate: true, flush: 'sync' })
function toggleTheme() { theme.change(isDark.value ? 'echoLight' : 'echoDark') }
const picker = ref(null), dragging = ref(false)
function choose(event) { const file = event.target.files?.[0]; if (file) e.load(file); event.target.value = '' }
function drop(event) { dragging.value = false; const file = event.dataTransfer.files?.[0]; if (file) e.load(file) }
</script>
<template>
  <v-app>
    <header class="app-header"><button class="brand" @click="e.screen.value = e.archive.value ? 'overview' : 'import'" aria-label="ECHO home"><span>ECHO</span></button>
      <nav v-if="e.archive.value" aria-label="Main navigation"><button v-for="item in [{ id: 'overview', title: 'Overview' }, { id: 'keywords', title: 'Keyword setup' }, { id: 'explorer', title: 'Message explorer' }]" :key="item.id" :class="{ current: e.screen.value === item.id }" :aria-current="e.screen.value === item.id ? 'page' : undefined" @click="e.screen.value = item.id">{{ item.title }}</button></nav>
      <div class="header-right"><span class="local-indicator"><i></i>Local only</span><v-btn role="switch" aria-label="Dark mode" :aria-checked="isDark" variant="text" :prepend-icon="isDark ? 'mdi-weather-night' : 'mdi-white-balance-sunny'" @click="toggleTheme">{{ isDark ? 'Dark' : 'Light' }}</v-btn><v-btn v-if="e.archive.value" variant="text" prepend-icon="mdi-file-replace-outline" @click="e.screen.value = 'import'">Replace archive</v-btn><v-btn variant="text" icon="mdi-cog-outline" aria-label="Settings" @click="e.settings.value = true"/></div>
    </header>
    <v-main>
      <v-alert v-if="e.error.value" type="error" variant="tonal" closable class="app-error" @click:close="e.error.value = ''" role="alert">{{ e.error.value }}</v-alert>
      <main v-if="e.screen.value === 'import'" class="import-screen">
        <section class="import-card"><div class="section-heading"><h2>{{ e.archive.value ? 'Replace your archive' : 'Open an archive' }}</h2><span class="subtle-label">JSON</span></div><div class="dropzone" :class="{ dragging, loading: e.loading.value }" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="drop"><v-icon size="42" color="primary">mdi-tray-arrow-up</v-icon><h3>Drop your JSON archive here</h3><p>or choose a file from your computer</p><v-btn color="primary" prepend-icon="mdi-folder-open-outline" :loading="e.loading.value" @click="picker.click()">Choose archive</v-btn><input ref="picker" type="file" accept=".json,application/json" hidden @change="choose" data-testid="archive-input"/></div><div class="demo-separator"><span></span>SAMPLE DATA<span></span></div><button class="demo-button" @click="e.load()" :disabled="e.loading.value"><div class="demo-icon"><v-icon>mdi-flask-outline</v-icon></div><div><strong>Try the sample archive</strong><span>7,000 messages · 15 channels · 2 weeks</span></div><v-icon>mdi-arrow-right</v-icon></button><p class="privacy-note"><v-icon size="14">mdi-lock-outline</v-icon>Processed on this computer. Nothing is saved.</p><v-btn v-if="e.archive.value" variant="text" block @click="e.screen.value = 'overview'">Return to current archive</v-btn></section>
      </main>
      <Overview v-if="e.archive.value && e.screen.value === 'overview'" :echo="e"/>
      <KeywordSetup v-if="e.archive.value && e.screen.value === 'keywords'" :echo="e"/>
      <Explorer v-show="e.screen.value === 'explorer'" v-if="e.archive.value" :key="e.archive.value" :echo="e"/>
    </v-main>
    <v-dialog v-model="e.settings.value" max-width="440"><v-card class="settings-card"><v-card-title>Settings</v-card-title><v-card-text><v-select v-model="e.clock.value" label="Time display" :items="[{ title: 'Source offsets', value: 'source' }, { title: 'UTC', value: 'utc' }]"/><p class="tiny-note">Messages use their original offsets. Shared controls use the earliest message’s offset in source mode.</p><v-text-field class="mt-6" :model-value="e.neighbors.value" @update:model-value="e.neighbors.value = Math.max(0, Math.min(100, Math.floor(Number($event) || 0)))" type="number" min="0" max="100" label="Context neighbors on each side"/><p class="tiny-note">Updates all open conversation contexts.</p></v-card-text><v-card-actions><v-spacer/><v-btn color="primary" variant="flat" @click="e.settings.value = false">Done</v-btn></v-card-actions></v-card></v-dialog>
  </v-app>
</template>
