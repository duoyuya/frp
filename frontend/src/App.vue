<template>
  <div id="app">
    <el-container style="min-height: 100vh;">
      <!-- 导航栏 -->
      <el-header height="60px" class="header">
        <div class="container">
          <div class="logo">
            <i class="el-icon-connection"></i>
            <span class="ml-2">FRP Panel</span>
          </div>
          
          <div class="nav">
            <el-menu :default-active="activeMenu" mode="horizontal" background-color="#1f2937" text-color="#fff" active-text-color="#409EFF">
              <el-menu-item index="/">首页</el-menu-item>
              
              <template v-if="isAuthenticated">
                <el-menu-item index="/dashboard">仪表盘</el-menu-item>
                <el-menu-item index="/ports">我的端口</el-menu-item>
                <el-menu-item index="/traffic">流量统计</el-menu-item>
                
                <template v-if="isAdmin">
                  <el-sub-menu index="/admin">
                    <template #title>管理员</template>
                    <el-menu-item index="/admin/users">用户管理</el-menu-item>
                    <el-menu-item index="/admin/ports">端口管理</el-menu-item>
                    <el-menu-item index="/admin/stats">系统统计</el-menu-item>
                  </el-sub-menu>
                </template>
              </template>
              
              <template v-else>
                <el-menu-item index="/login">登录</el-menu-item>
                <el-menu-item index="/register">注册</el-menu-item>
              </template>
            </el-menu>
            
            <template v-if="isAuthenticated">
              <div class="user-info">
                <el-dropdown>
                  <span class="el-dropdown-link">
                    {{ userEmail }} <i class="el-icon-arrow-down el-icon--right"></i>
                  </span>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="handleLogout">退出登录</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </div>
        </div>
      </el-header>
      
      <!-- 主内容区 -->
      <el-main>
        <div class="container">
          <!-- 加载中 -->
          <el-loading v-if="loading" :fullscreen="true" background="rgba(0, 0, 0, 0.7)"></el-loading>
          
          <!-- 错误提示 -->
          <el-alert 
            v-if="error" 
            :title="error" 
            type="error" 
            show-icon 
            @close="clearError"
            class="mb-4"
          ></el-alert>
          
          <!-- 路由视图 -->
          <router-view />
        </div>
      </el-main>
      
      <!-- 页脚 -->
      <el-footer height="60px" class="footer">
        <div class="container text-center">
          <p>© 2024 FRP Panel - 内网穿透管理平台</p>
        </div>
      </el-footer>
    </el-container>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useStore } from 'vuex'
import { useRoute } from 'vue-router'

export default {
  name: 'App',
  setup() {
    const store = useStore()
    const route = useRoute()
    
    // 计算属性
    const isAuthenticated = computed(() => store.getters.isAuthenticated)
    const isAdmin = computed(() => store.getters.isAdmin)
    const userEmail = computed(() => store.getters.userEmail)
    const loading = computed(() => store.state.loading)
    const error = computed(() => store.state.error)
    const activeMenu = computed(() => route.path)
    
    // 方法
    const handleLogout = () => {
      store.dispatch('logout').then(() => {
        this.$router.push('/login')
      })
    }
    
    const clearError = () => {
      store.commit('setError', null)
    }
    
    return {
      isAuthenticated,
      isAdmin,
      userEmail,
      loading,
      error,
      activeMenu,
      handleLogout,
      clearError
    }
  }
}
</script>

<style scoped>
.header {
  background-color: #1f2937;
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.footer {
  background-color: #f8f9fa;
  color: #6c757d;
  border-top: 1px solid #e9ecef;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

.logo {
  display: flex;
  align-items: center;
  font-size: 1.2rem;
  font-weight: bold;
}

.nav {
  display: flex;
  align-items: center;
}

.user-info {
  margin-left: 20px;
  color: white;
}

.el-dropdown-link {
  color: white;
  cursor: pointer;
}
</style>