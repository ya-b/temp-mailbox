import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import clickOutside from './directives/v-click-outside'

const app = createApp(App)

app.use(router)
app.use(i18n)

app.directive('click-outside', clickOutside)

app.mount('#app')
