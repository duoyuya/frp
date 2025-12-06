import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import ForgotPassword from '../views/ForgotPassword.vue'
import ResetPassword from '../views/ResetPassword.vue'
import VerifyEmail from '../views/VerifyEmail.vue'
import Dashboard from '../views/Dashboard.vue'
import UserPorts from '../views/UserPorts.vue'
import TrafficStats from '../views/TrafficStats.vue'
import AdminUsers from '../views/admin/AdminUsers.vue'
import AdminPorts from '../views/admin/AdminPorts.vue'
import AdminStats from '../views/admin/AdminStats.vue'

// 路由守卫
const requireAuth = (to, from, next) => {
  const token = localStorage.getItem('token')
  if (!token) {
    next('/login')
  } else {
    next()
  }
}

const requireAdmin = (to, from, next) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  if (!user.is_admin) {
    next('/dashboard')
  } else {
    next()
  }
}

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { guest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: Register,
    meta: { guest: true }
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: ForgotPassword,
    meta: { guest: true }
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: ResetPassword,
    meta: { guest: true }
  },
  {
    path: '/verify-email',
    name: 'VerifyEmail',
    component: VerifyEmail,
    meta: { guest: true }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    beforeEnter: requireAuth
  },
  {
    path: '/ports',
    name: 'UserPorts',
    component: UserPorts,
    beforeEnter: requireAuth
  },
  {
    path: '/traffic',
    name: 'TrafficStats',
    component: TrafficStats,
    beforeEnter: requireAuth
  },
  {
    path: '/admin/users',
    name: 'AdminUsers',
    component: AdminUsers,
    beforeEnter: [requireAuth, requireAdmin]
  },
  {
    path: '/admin/ports',
    name: 'AdminPorts',
    component: AdminPorts,
    beforeEnter: [requireAuth, requireAdmin]
  },
  {
    path: '/admin/stats',
    name: 'AdminStats',
    component: AdminStats,
    beforeEnter: [requireAuth, requireAdmin]
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

// 全局前置守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  
  // 如果是需要认证的路由但没有token
  if (to.meta.guest && token) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router