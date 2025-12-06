import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import store from './store'
import axios from 'axios'

// 配置axios
axios.defaults.baseURL = process.env.VUE_APP_API_URL || '/api/v1'

// 请求拦截器
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, error => {
  return Promise.reject(error)
})

// 响应拦截器
axios.interceptors.response.use(response => {
  return response
}, error => {
  if (error.response && error.response.status === 401) {
    // 未授权，跳转到登录页
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }
  return Promise.reject(error)
})

const app = createApp(App)

// 注册Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(ElementPlus)
app.use(router)
app.use(store)

// 全局属性
app.config.globalProperties.$axios = axios

app.mount('#app')