import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import { VApp, VMain, VBtn, VIcon, VAlert, VProgressLinear, VProgressCircular, VTextField, VSelect, VPagination, VDialog, VCard, VCardTitle, VCardText, VCardActions, VSpacer } from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './style.css'
import { themes } from './theme.js'
import App from './App.vue'
const vuetify = createVuetify({
  components: { VApp, VMain, VBtn, VIcon, VAlert, VProgressLinear, VProgressCircular, VTextField, VSelect, VPagination, VDialog, VCard, VCardTitle, VCardText, VCardActions, VSpacer }, directives,
  theme: { defaultTheme: 'echoDark', themes },
  defaults: { VBtn: { elevation: 0, rounded: 0, size: 'small' }, VTextField: { variant: 'outlined', density: 'compact', hideDetails: 'auto' }, VSelect: { variant: 'outlined', density: 'compact', hideDetails: 'auto' }, VCheckbox: { density: 'compact', hideDetails: true }, VChip: { size: 'small' } },
})
createApp(App).use(vuetify).mount('#app')
