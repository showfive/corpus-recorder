import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import './assets/index.css'

const app = createApp(App)

// Piniaを使用
app.use(createPinia())

// Element Plusを使用
app.use(ElementPlus)

app.mount('#app')