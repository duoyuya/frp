<template>
  <div class="traffic-stats">
    <el-card shadow="hover">
      <template #header>
        <div class="header">
          <span>流量统计</span>
          <el-radio-group v-model="timeRange" @change="handleTimeRangeChange" size="small">
            <el-radio-button label="1h">1小时</el-radio-button>
            <el-radio-button label="12h">12小时</el-radio-button>
            <el-radio-button label="24h">24小时</el-radio-button>
            <el-radio-button label="48h">48小时</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      
      <!-- 统计卡片 -->
      <div class="stats-cards">
        <el-card class="stat-card">
          <div class="stat-title">总上传</div>
          <div class="stat-value">{{ totalUpload | formatBytes }}</div>
        </el-card>
        
        <el-card class="stat-card">
          <div class="stat-title">总下载</div>
          <div class="stat-value">{{ totalDownload | formatBytes }}</div>
        </el-card>
        
        <el-card class="stat-card">
          <div class="stat-title">总流量</div>
          <div class="stat-value">{{ totalTraffic | formatBytes }}</div>
        </el-card>
        
        <el-card class="stat-card">
          <div class="stat-title">在线端口</div>
          <div class="stat-value">{{ onlinePorts }}/{{ totalPorts }}</div>
        </el-card>
      </div>
      
      <!-- 流量图表 -->
      <div class="chart-container">
        <el-card class="chart-card">
          <template #header>
            <div class="chart-title">流量趋势图</div>
          </template>
          <div class="chart-wrapper">
            <v-chart 
              :options="chartOptions" 
              autoresize 
              style="height: 400px;"
            />
          </div>
        </el-card>
      </div>
      
      <!-- 端口流量详情 -->
      <el-card class="mt-4">
        <template #header>
          <div class="chart-title">端口流量详情</div>
        </template>
        <el-table :data="portTrafficData" stripe style="width: 100%">
          <el-table-column prop="port" label="端口" width="80" />
          <el-table-column prop="description" label="描述" />
          <el-table-column 
            prop="upload" 
            label="上传" 
            width="120"
            :formatter="formatBytes"
          />
          <el-table-column 
            prop="download" 
            label="下载" 
            width="120"
            :formatter="formatBytes"
          />
          <el-table-column 
            prop="total" 
            label="总计" 
            width="120"
            :formatter="formatBytes"
          />
          <el-table-column 
            prop="lastActive" 
            label="最后活跃" 
            width="160"
            :formatter="formatDateTime"
          />
        </el-table>
      </el-card>
    </el-card>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useStore } from 'vuex'
import { useRoute } from 'vue-router'
import { VChart } from 'vue-echarts'
import { 
  BarChart, 
  LineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'vue-echarts/components'
import dayjs from 'dayjs'

// 注册组件
VChart.component('BarChart', BarChart)
VChart.component('LineChart', LineChart)
VChart.component('Bar', Bar)
VChart.component('Line', Line)
VChart.component('XAxis', XAxis)
VChart.component('YAxis', YAxis)
VChart.component('CartesianGrid', CartesianGrid)
VChart.component('Tooltip', Tooltip)
VChart.component('Legend', Legend)
VChart.component('ResponsiveContainer', ResponsiveContainer)

export default {
  components: {
    VChart
  },
  setup() {
    const store = useStore()
    const route = useRoute()
    
    // 状态
    const timeRange = ref('24h')
    const loading = ref(false)
    const chartOptions = reactive({
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#6a7985'
          }
        }
      },
      legend: {
        data: ['上传流量', '下载流量'],
        top: 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: [
        {
          type: 'category',
          boundaryGap: false,
          data: []
        }
      ],
      yAxis: [
        {
          type: 'value',
          name: '流量 (MB)',
          axisLabel: {
            formatter: '{value}'
          }
        }
      ],
      series: [
        {
          name: '上传流量',
          type: 'line',
          stack: 'Total',
          smooth: true,
          areaStyle: {},
          emphasis: {
            focus: 'series'
          },
          data: []
        },
        {
          name: '下载流量',
          type: 'line',
          stack: 'Total',
          smooth: true,
          areaStyle: {},
          emphasis: {
            focus: 'series'
          },
          data: []
        }
      ]
    })
    
    // 计算属性
    const totalUpload = computed(() => {
      return store.state.trafficStats.uploadData.reduce((sum, val) => sum + val, 0)
    })
    
    const totalDownload = computed(() => {
      return store.state.trafficStats.downloadData.reduce((sum, val) => sum + val, 0)
    })
    
    const totalTraffic = computed(() => {
      return totalUpload.value + totalDownload.value
    })
    
    const onlinePorts = computed(() => {
      return store.state.ports.filter(port => port.is_active).length
    })
    
    const totalPorts = computed(() => {
      return store.state.ports.length
    })
    
    const portTrafficData = computed(() => {
      // 这里应该从API获取端口流量详情
      return store.state.ports.map(port => ({
        port: port.port_number,
        description: port.description || '未设置描述',
        upload: Math.floor(Math.random() * 100000000), // 模拟数据
        download: Math.floor(Math.random() * 500000000), // 模拟数据
        total: 0,
        lastActive: new Date().toISOString()
      })).map(item => ({
        ...item,
        total: item.upload + item.download
      }))
    })
    
    // 方法
    const fetchTrafficStats = async () => {
      loading.value = true
      try {
        const stats = await store.dispatch('fetchTrafficStats', timeRange.value)
        
        // 更新图表数据
        chartOptions.xAxis[0].data = stats.labels
        chartOptions.series[0].data = stats.uploadData.map(val => val / (1024 * 1024)) // 转换为MB
        chartOptions.series[1].data = stats.downloadData.map(val => val / (1024 * 1024)) // 转换为MB
      } catch (error) {
        console.error('获取流量统计失败:', error)
      } finally {
        loading.value = false
      }
    }
    
    const handleTimeRangeChange = () => {
      fetchTrafficStats()
    }
    
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }
    
    const formatDateTime = (dateTime) => {
      return dayjs(dateTime).format('YYYY-MM-DD HH:mm:ss')
    }
    
    // 生命周期
    onMounted(() => {
      fetchTrafficStats()
    })
    
    return {
      timeRange,
      loading,
      chartOptions,
      totalUpload,
      totalDownload,
      totalTraffic,
      onlinePorts,
      totalPorts,
      portTrafficData,
      handleTimeRangeChange,
      formatBytes,
      formatDateTime
    }
  },
  filters: {
    formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }
  }
}
</script>

<style scoped>
.traffic-stats {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  text-align: center;
  padding: 16px;
}

.stat-title {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.chart-container {
  margin-bottom: 24px;
}

.chart-card {
  height: 100%;
}

.chart-title {
  font-size: 16px;
  font-weight: bold;
}

.chart-wrapper {
  height: 400px;
}
</style>