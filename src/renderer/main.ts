import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import './assets/index.css'
import { registerServices, validateServiceRegistration } from '../common/di/serviceRegistry'

// DIサービスの登録
console.log('Registering DI services...')
registerServices()

// サービス登録の検証
if (!validateServiceRegistration()) {
  console.error('Service registration validation failed!')
  throw new Error('Required services are not properly registered')
}

console.log('DI services registered successfully')

const app = createApp(App)

// Piniaを使用
app.use(createPinia())

// Element Plusを使用
app.use(ElementPlus)

app.mount('#app')