import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import './assets/index.css'

const app = createApp(App)

// Element Plusを使用
app.use(ElementPlus)

app.mount('#app') 