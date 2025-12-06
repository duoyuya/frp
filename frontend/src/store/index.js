import { createStore } from 'vuex'
import axios from 'axios'

export default createStore({
  state: {
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('token'),
    loading: false,
    error: null,
    ports: [],
    trafficStats: {
      labels: [],
      uploadData: [],
      downloadData: []
    }
  },
  mutations: {
    setUser(state, user) {
      state.user = user
      localStorage.setItem('user', JSON.stringify(user))
    },
    setToken(state, token) {
      state.token = token
      localStorage.setItem('token', token)
    },
    clearAuth(state) {
      state.user = null
      state.token = null
      localStorage.removeItem('user')
      localStorage.removeItem('token')
    },
    setLoading(state, loading) {
      state.loading = loading
    },
    setError(state, error) {
      state.error = error
    },
    setPorts(state, ports) {
      state.ports = ports
    },
    addPort(state, port) {
      state.ports.push(port)
    },
    removePort(state, portId) {
      state.ports = state.ports.filter(port => port.id !== portId)
    },
    setTrafficStats(state, stats) {
      state.trafficStats = stats
    }
  },
  actions: {
    async login({ commit }, credentials) {
      commit('setLoading', true)
      commit('setError', null)
      
      try {
        const response = await axios.post('/token', new URLSearchParams({
          username: credentials.email,
          password: credentials.password
        }))
        
        const { access_token } = response.data
        
        // 获取用户信息
        const userResponse = await axios.get('/users/me', {
          headers: {
            Authorization: `Bearer ${access_token}`
          }
        })
        
        commit('setToken', access_token)
        commit('setUser', userResponse.data)
        
        return userResponse.data
        
      } catch (error) {
        commit('setError', error.response?.data?.detail || '登录失败')
        throw error
      } finally {
        commit('setLoading', false)
      }
    },
    
    async register({ commit }, userData) {
      commit('setLoading', true)
      commit('setError', null)
      
      try {
        const response = await axios.post('/auth/register', userData)
        return response.data
      } catch (error) {
        commit('setError', error.response?.data?.detail || '注册失败')
        throw error
      } finally {
        commit('setLoading', false)
      }
    },
    
    async logout({ commit }) {
      try {
        await axios.post('/auth/logout')
      } catch (error) {
        console.error('Logout error:', error)
      } finally {
        commit('clearAuth')
      }
    },
    
    async fetchPorts({ commit }) {
      commit('setLoading', true)
      
      try {
        const response = await axios.get('/users/me/ports')
        commit('setPorts', response.data)
        return response.data
      } catch (error) {
        commit('setError', error.response?.data?.detail || '获取端口失败')
        throw error
      } finally {
        commit('setLoading', false)
      }
    },
    
    async createPort({ commit }, portData) {
      commit('setLoading', true)
      
      try {
        const response = await axios.post('/users/me/ports', portData)
        commit('addPort', response.data)
        return response.data
      } catch (error) {
        commit('setError', error.response?.data?.detail || '创建端口失败')
        throw error
      } finally {
        commit('setLoading', false)
      }
    },
    
    async deletePort({ commit }, portId) {
      commit('setLoading', true)
      
      try {
        await axios.delete(`/users/me/ports/${portId}`)
        commit('removePort', portId)
      } catch (error) {
        commit('setError', error.response?.data?.detail || '删除端口失败')
        throw error
      } finally {
        commit('setLoading', false)
      }
    },
    
    async fetchTrafficStats({ commit }, timeRange = '24h') {
      commit('setLoading', true)
      
      try {
        const response = await axios.get('/stats/traffic', {
          params: { time_range: timeRange }
        })
        
        // 处理统计数据
        const stats = {
          labels: response.data.labels,
          uploadData: response.data.upload_data,
          downloadData: response.data.download_data
        }
        
        commit('setTrafficStats', stats)
        return stats
      } catch (error) {
        commit('setError', error.response?.data?.detail || '获取流量统计失败')
        throw error
      } finally {
        commit('setLoading', false)
      }
    }
  },
  getters: {
    isAuthenticated: state => !!state.token,
    isAdmin: state => state.user?.is_admin || false,
    userEmail: state => state.user?.email || '',
    portCount: state => state.ports.length,
    maxPorts: state => 5,
    remainingPorts: state => 5 - state.ports.length
  }
})