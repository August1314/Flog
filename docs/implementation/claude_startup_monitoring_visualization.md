# Claude启动状态监测可视化展示组件实现

## 1. 可视化组件设计

### 1.1 整体布局

```vue
<template>
  <div class="claude-monitoring">
    <h2>Claude启动状态监测</h2>
    
    <div class="dashboard-grid">
      <!-- 启动状态卡片 -->
      <div class="card status-card">
        <StatusCard />
      </div>
      
      <!-- 启动时间图表 -->
      <div class="card chart-card">
        <TimeChart />
      </div>
      
      <!-- 启动会话记录 -->
      <div class="card sessions-card">
        <SessionsTable />
      </div>
      
      <!-- 告警记录 -->
      <div class="card alerts-card">
        <AlertsTable />
      </div>
      
      <!-- 配置管理 -->
      <div class="card config-card">
        <ConfigForm />
      </div>
    </div>
  </div>
</template>

<script setup>
import StatusCard from './components/StatusCard.vue';
import TimeChart from './components/TimeChart.vue';
import SessionsTable from './components/SessionsTable.vue';
import AlertsTable from './components/AlertsTable.vue';
import ConfigForm from './components/ConfigForm.vue';
</script>

<style scoped>
.claude-monitoring {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

h2 {
  margin-bottom: 20px;
  color: #333;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.status-card {
  grid-column: 1 / -1;
}

.chart-card {
  grid-column: 1 / -1;
}

@media (min-width: 768px) {
  .sessions-card {
    grid-column: 1 / 2;
  }
  
  .alerts-card {
    grid-column: 2 / 3;
  }
  
  .config-card {
    grid-column: 1 / -1;
  }
}
</style>
```

### 1.2 启动状态卡片组件

```vue
<template>
  <div class="status-card">
    <h3>启动状态</h3>
    <div class="status-container">
      <div class="status-indicator" :class="statusClass">
        <div class="status-dot"></div>
        <div class="status-text">{{ statusText }}</div>
      </div>
      <div class="status-details">
        <div class="detail-item">
          <span class="label">当前状态:</span>
          <span class="value">{{ statusText }}</span>
        </div>
        <div class="detail-item" v-if="startupInfo.start_time">
          <span class="label">启动开始时间:</span>
          <span class="value">{{ formatTime(startupInfo.start_time) }}</span>
        </div>
        <div class="detail-item" v-if="startupInfo.end_time">
          <span class="label">启动结束时间:</span>
          <span class="value">{{ formatTime(startupInfo.end_time) }}</span>
        </div>
        <div class="detail-item" v-if="startupInfo.duration_ms">
          <span class="label">启动耗时:</span>
          <span class="value">{{ startupInfo.duration_ms }}ms</span>
        </div>
        <div class="detail-item error" v-if="startupInfo.failure_reason">
          <span class="label">失败原因:</span>
          <span class="value">{{ startupInfo.failure_reason }}</span>
        </div>
      </div>
    </div>
    <div class="status-actions">
      <button @click="startStartup" :disabled="isStarting" class="btn btn-primary">
        开始启动
      </button>
      <button @click="markSuccess" :disabled="!isStarting" class="btn btn-success">
        标记成功
      </button>
      <button @click="markFailure" :disabled="!isStarting" class="btn btn-danger">
        标记失败
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';

const startupInfo = ref({
  status: 'NotStarted',
  start_time: null,
  end_time: null,
  duration_ms: null,
  failure_reason: null
});

const isStarting = computed(() => {
  return startupInfo.value.status === 'Starting';
});

const statusClass = computed(() => {
  switch (startupInfo.value.status) {
    case 'NotStarted': return 'not-started';
    case 'Starting': return 'starting';
    case 'Started': return 'started';
    case 'Failed': return 'failed';
    default: return 'unknown';
  }
});

const statusText = computed(() => {
  switch (startupInfo.value.status) {
    case 'NotStarted': return '未启动';
    case 'Starting': return '启动中';
    case 'Started': return '启动成功';
    case 'Failed': return '启动失败';
    default: return '未知';
  }
});

const formatTime = (time) => {
  if (!time) return 'N/A';
  return new Date(time).toLocaleString();
};

const fetchStatus = async () => {
  try {
    const response = await fetch('/claude/startup/status');
    const data = await response.json();
    startupInfo.value = data;
  } catch (error) {
    console.error('获取启动状态失败:', error);
  }
};

const startStartup = async () => {
  try {
    await fetch('/claude/startup/start', {
      method: 'POST'
    });
    await fetchStatus();
  } catch (error) {
    console.error('开始启动失败:', error);
  }
};

const markSuccess = async () => {
  try {
    await fetch('/claude/startup/success', {
      method: 'POST'
    });
    await fetchStatus();
  } catch (error) {
    console.error('标记成功失败:', error);
  }
};

const markFailure = async () => {
  const reason = prompt('请输入失败原因:');
  if (reason) {
    try {
      await fetch('/claude/startup/failure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      await fetchStatus();
    } catch (error) {
      console.error('标记失败失败:', error);
    }
  }
};

onMounted(() => {
  fetchStatus();
  // 每5秒刷新一次状态
  setInterval(fetchStatus, 5000);
});
</script>

<style scoped>
.status-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 18px;
  color: #333;
}

.status-container {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 20px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  font-weight: bold;
  font-size: 16px;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-indicator.not-started {
  background-color: #e9ecef;
  color: #6c757d;
}

.status-indicator.not-started .status-dot {
  background-color: #6c757d;
}

.status-indicator.starting {
  background-color: #fff3cd;
  color: #856404;
}

.status-indicator.starting .status-dot {
  background-color: #ffc107;
}

.status-indicator.started {
  background-color: #d4edda;
  color: #155724;
}

.status-indicator.started .status-dot {
  background-color: #28a745;
}

.status-indicator.failed {
  background-color: #f8d7da;
  color: #721c24;
}

.status-indicator.failed .status-dot {
  background-color: #dc3545;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.status-details {
  flex: 1;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.detail-item:last-child {
  border-bottom: none;
}

.label {
  font-weight: 500;
  color: #6c757d;
}

.value {
  color: #333;
}

.detail-item.error .value {
  color: #721c24;
  font-weight: 500;
}

.status-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0069d9;
}

.btn-success {
  background-color: #28a745;
  color: white;
}

.btn-success:hover {
  background-color: #218838;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover {
  background-color: #c82333;
}

.btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}
</style>
```

### 1.3 启动时间图表组件

```vue
<template>
  <div class="time-chart">
    <h3>启动时间趋势</h3>
    <div class="chart-container">
      <canvas ref="chartRef"></canvas>
    </div>
    <div class="chart-controls">
      <select v-model="timeRange" @change="fetchData">
        <option value="24h">最近24小时</option>
        <option value="7d">最近7天</option>
        <option value="30d">最近30天</option>
        <option value="90d">最近90天</option>
      </select>
      <button @click="fetchData" class="btn btn-sm btn-primary">
        刷新
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import Chart from 'chart.js/auto';

const chartRef = ref(null);
const chart = ref(null);
const timeRange = ref('7d');

const fetchData = async () => {
  try {
    const response = await fetch(`/claude/startup/history?range=${timeRange.value}`);
    const data = await response.json();
    updateChart(data);
  } catch (error) {
    console.error('获取启动时间历史失败:', error);
  }
};

const updateChart = (data) => {
  if (!chartRef.value) return;
  
  const labels = data.map(item => new Date(item.timestamp).toLocaleString());
  const values = data.map(item => item.duration_ms);
  
  if (chart.value) {
    chart.value.destroy();
  }
  
  chart.value = new Chart(chartRef.value, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: '启动时间 (ms)',
        data: values,
        borderColor: '#007bff',
        backgroundColor: 'rgba(0, 123, 255, 0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#007bff',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `启动时间: ${context.parsed.y}ms`;
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: '时间'
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: '启动时间 (ms)'
          },
          beginAtZero: true
        }
      }
    }
  });
};

onMounted(() => {
  fetchData();
  // 每30秒刷新一次数据
  const interval = setInterval(fetchData, 30000);
  onUnmounted(() => clearInterval(interval));
});
</script>

<style scoped>
.time-chart {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 18px;
  color: #333;
}

.chart-container {
  height: 300px;
  margin-bottom: 16px;
}

.chart-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

select {
  padding: 6px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0069d9;
}
</style>
```

### 1.4 启动会话表格组件

```vue
<template>
  <div class="sessions-table">
    <h3>启动会话记录</h3>
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>会话ID</th>
            <th>状态</th>
            <th>开始时间</th>
            <th>结束时间</th>
            <th>耗时 (ms)</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="session in sessions" :key="session.id" :class="statusClass(session.status)">
            <td>{{ session.id.substring(0, 8) }}...</td>
            <td>{{ statusText(session.status) }}</td>
            <td>{{ formatTime(session.start_time) }}</td>
            <td>{{ formatTime(session.end_time) }}</td>
            <td>{{ session.duration_ms || '-' }}</td>
            <td>
              <button @click="viewSessionLogs(session.id)" class="btn btn-sm btn-primary">
                查看日志
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="pagination" v-if="total > pageSize">
      <button @click="loadPreviousPage" :disabled="currentPage === 1" class="btn btn-sm">
        上一页
      </button>
      <span>第 {{ currentPage }} 页，共 {{ totalPages }} 页</span>
      <button @click="loadNextPage" :disabled="currentPage === totalPages" class="btn btn-sm">
        下一页
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';

const sessions = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = 10;

const totalPages = computed(() => {
  return Math.ceil(total.value / pageSize);
});

const statusClass = (status) => {
  switch (status) {
    case 'NotStarted': return 'not-started';
    case 'Starting': return 'starting';
    case 'Started': return 'started';
    case 'Failed': return 'failed';
    default: return 'unknown';
  }
};

const statusText = (status) => {
  switch (status) {
    case 'NotStarted': return '未启动';
    case 'Starting': return '启动中';
    case 'Started': return '启动成功';
    case 'Failed': return '启动失败';
    default: return '未知';
  }
};

const formatTime = (time) => {
  if (!time) return '-';
  return new Date(time).toLocaleString();
};

const fetchSessions = async (page) => {
  try {
    const offset = (page - 1) * pageSize;
    const response = await fetch(`/claude/startup/sessions?limit=${pageSize}&offset=${offset}`);
    const data = await response.json();
    sessions.value = data.records;
    total.value = data.total;
    currentPage.value = page;
  } catch (error) {
    console.error('获取启动会话失败:', error);
  }
};

const loadPreviousPage = () => {
  if (currentPage.value > 1) {
    fetchSessions(currentPage.value - 1);
  }
};

const loadNextPage = () => {
  if (currentPage.value < totalPages.value) {
    fetchSessions(currentPage.value + 1);
  }
};

const viewSessionLogs = (sessionId) => {
  // 跳转到日志详情页面
  // 这里可以实现路由跳转或打开模态框
  console.log('查看会话日志:', sessionId);
};

onMounted(() => {
  fetchSessions(1);
});
</script>

<style scoped>
.sessions-table {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 18px;
  color: #333;
}

.table-container {
  overflow-x: auto;
  margin-bottom: 16px;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #333;
}

.table tr:hover {
  background-color: #f8f9fa;
}

.table tr.not-started {
  background-color: #f8f9fa;
}

.table tr.starting {
  background-color: #fff3cd;
}

.table tr.started {
  background-color: #d4edda;
}

.table tr.failed {
  background-color: #f8d7da;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
}

.btn {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0069d9;
}

.btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}
</style>
```

### 1.5 告警记录表格组件

```vue
<template>
  <div class="alerts-table">
    <h3>告警记录</h3>
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>时间</th>
            <th>标题</th>
            <th>消息</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="alert in alerts" :key="alert.id" :class="{ 'unacknowledged': !alert.acknowledged }">
            <td>{{ formatTime(alert.created_at) }}</td>
            <td>{{ alert.title }}</td>
            <td>{{ alert.message }}</td>
            <td>{{ alert.acknowledged ? '已确认' : '未确认' }}</td>
            <td>
              <button v-if="!alert.acknowledged" @click="acknowledgeAlert(alert.id)" class="btn btn-sm btn-primary">
                确认
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="pagination" v-if="total > pageSize">
      <button @click="loadPreviousPage" :disabled="currentPage === 1" class="btn btn-sm">
        上一页
      </button>
      <span>第 {{ currentPage }} 页，共 {{ totalPages }} 页</span>
      <button @click="loadNextPage" :disabled="currentPage === totalPages" class="btn btn-sm">
        下一页
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';

const alerts = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = 10;

const totalPages = computed(() => {
  return Math.ceil(total.value / pageSize);
});

const formatTime = (time) => {
  if (!time) return '-';
  return new Date(time).toLocaleString();
};

const fetchAlerts = async (page) => {
  try {
    const offset = (page - 1) * pageSize;
    const response = await fetch(`/claude/alerts?limit=${pageSize}&offset=${offset}`);
    const data = await response.json();
    alerts.value = data.records;
    total.value = data.total;
    currentPage.value = page;
  } catch (error) {
    console.error('获取告警记录失败:', error);
  }
};

const loadPreviousPage = () => {
  if (currentPage.value > 1) {
    fetchAlerts(currentPage.value - 1);
  }
};

const loadNextPage = () => {
  if (currentPage.value < totalPages.value) {
    fetchAlerts(currentPage.value + 1);
  }
};

const acknowledgeAlert = async (id) => {
  try {
    const response = await fetch(`/claude/alerts/${id}/acknowledge`, {
      method: 'POST'
    });
    const data = await response.json();
    if (data.success) {
      // 刷新告警列表
      fetchAlerts(currentPage.value);
    }
  } catch (error) {
    console.error('确认告警失败:', error);
  }
};

onMounted(() => {
  fetchAlerts(1);
  // 每30秒刷新一次
  setInterval(() => fetchAlerts(currentPage.value), 30000);
});
</script>

<style scoped>
.alerts-table {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 18px;
  color: #333;
}

.table-container {
  overflow-x: auto;
  margin-bottom: 16px;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #333;
}

.table tr:hover {
  background-color: #f8f9fa;
}

.table tr.unacknowledged {
  background-color: #f8d7da;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
}

.btn {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0069d9;
}

.btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}
</style>
```

### 1.6 配置管理表单组件

```vue
<template>
  <div class="config-form">
    <h3>配置管理</h3>
    <form @submit.prevent="saveConfig">
      <div class="form-group">
        <label for="startupTimeout">启动超时阈值 (秒)</label>
        <input 
          type="number" 
          id="startupTimeout" 
          v-model.number="config.startup_timeout_seconds" 
          min="1" 
          max="300"
        >
      </div>
      <div class="form-group">
        <label for="alertThreshold">告警阈值 (毫秒)</label>
        <input 
          type="number" 
          id="alertThreshold" 
          v-model.number="config.alert_threshold_ms" 
          min="1000" 
          max="60000"
        >
      </div>
      <div class="form-group">
        <label for="enableAlert">启用告警</label>
        <input type="checkbox" id="enableAlert" v-model="config.enable_alert">
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">
          保存配置
        </button>
        <button type="button" @click="resetConfig" class="btn btn-secondary">
          重置
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const config = ref({
  startup_timeout_seconds: 30,
  alert_threshold_ms: 10000,
  enable_alert: true
});

const fetchConfig = async () => {
  try {
    const response = await fetch('/claude/startup/config');
    const data = await response.json();
    config.value = data;
  } catch (error) {
    console.error('获取配置失败:', error);
  }
};

const saveConfig = async () => {
  try {
    const response = await fetch('/claude/startup/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config.value)
    });
    const data = await response.json();
    if (data.success) {
      alert('配置保存成功');
    } else {
      alert('配置保存失败: ' + data.message);
    }
  } catch (error) {
    console.error('保存配置失败:', error);
    alert('配置保存失败');
  }
};

const resetConfig = () => {
  config.value = {
    startup_timeout_seconds: 30,
    alert_threshold_ms: 10000,
    enable_alert: true
  };
};

onMounted(() => {
  fetchConfig();
});
</script>

<style scoped>
.config-form {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 18px;
  color: #333;
}

form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

label {
  font-weight: 500;
  color: #333;
}

input[type="number"] {
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0069d9;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #5a6268;
}
</style>
```

## 2. 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | 3.x | 前端框架 |
| Chart.js | 4.x | 数据可视化 |
| Axios | 1.x | HTTP请求 |
| Vite | 4.x | 构建工具 |
| Tailwind CSS | 3.x | 样式框架 |

## 3. 数据可视化实现

### 3.1 启动时间趋势图

使用Chart.js实现启动时间的趋势图表，展示最近一段时间的启动时间变化趋势。图表包含以下功能：
- 折线图展示启动时间变化
- 支持不同时间范围的选择
- 悬停显示详细数据
- 响应式设计，适应不同屏幕尺寸

### 3.2 启动状态仪表盘

使用卡片式设计展示当前启动状态，包含以下功能：
- 状态指示器，显示当前启动状态
- 状态详细信息，包括开始时间、结束时间、耗时等
- 操作按钮，允许手动控制启动过程
- 实时状态更新

### 3.3 历史数据表格

使用表格展示启动会话历史和告警记录，包含以下功能：
- 分页功能，支持浏览大量历史数据
- 状态分类显示，使用不同颜色区分不同状态
- 操作按钮，允许查看详细日志和确认告警
- 排序和过滤功能

## 4. 前端与后端集成

### 4.1 API调用

使用Axios进行API调用，实现与后端的通信：

```javascript
// api.js
import axios from 'axios';

const api = axios.create({
  baseURL: '/claude',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const startupApi = {
  // 获取启动状态
  getStatus: () => api.get('/startup/status'),
  // 开始启动
  startStartup: () => api.post('/startup/start'),
  // 标记启动成功
  markSuccess: () => api.post('/startup/success'),
  // 标记启动失败
  markFailure: (reason) => api.post('/startup/failure', { reason }),
  // 获取启动时间统计
  getStats: () => api.get('/startup/stats'),
  // 获取启动时间历史
  getHistory: (range) => api.get(`/startup/history?range=${range}`),
  // 获取启动配置
  getConfig: () => api.get('/startup/config'),
  // 更新启动配置
  updateConfig: (config) => api.put('/startup/config', config),
  // 获取告警列表
  getAlerts: (params) => api.get('/alerts', { params }),
  // 确认告警
  acknowledgeAlert: (id) => api.post(`/alerts/${id}/acknowledge`),
  // 获取启动会话列表
  getSessions: (params) => api.get('/startup/sessions', { params }),
  // 获取会话日志
  getSessionLogs: (sessionId) => api.get(`/startup/sessions/${sessionId}/logs`)
};
```

### 4.2 状态管理

使用Vue 3的Composition API进行状态管理：

```javascript
// store.js
import { ref, reactive, computed } from 'vue';
import { startupApi } from './api';

export function useStartupStore() {
  const status = ref(null);
  const history = ref([]);
  const sessions = ref([]);
  const alerts = ref([]);
  const config = ref(null);
  const loading = ref(false);
  const error = ref(null);

  // 获取启动状态
  const fetchStatus = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await startupApi.getStatus();
      status.value = response.data;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  // 获取启动时间历史
  const fetchHistory = async (range = '7d') => {
    loading.value = true;
    error.value = null;
    try {
      const response = await startupApi.getHistory(range);
      history.value = response.data;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  // 获取启动会话
  const fetchSessions = async (page = 1, limit = 10) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await startupApi.getSessions({ page, limit });
      sessions.value = response.data;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  // 获取告警
  const fetchAlerts = async (page = 1, limit = 10) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await startupApi.getAlerts({ page, limit });
      alerts.value = response.data;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  // 获取配置
  const fetchConfig = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await startupApi.getConfig();
      config.value = response.data;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  // 保存配置
  const saveConfig = async (newConfig) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await startupApi.updateConfig(newConfig);
      config.value = newConfig;
      return response.data;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    status,
    history,
    sessions,
    alerts,
    config,
    loading,
    error,
    fetchStatus,
    fetchHistory,
    fetchSessions,
    fetchAlerts,
    fetchConfig,
    saveConfig
  };
}
```

## 5. 集成步骤

### 5.1 前端集成

1. **安装依赖**：
   ```bash
   cd /Users/lianglihang/Documents/programs/cc-switch
   npm install chart.js axios
   ```

2. **创建组件**：
   - 创建 `src/components/claude-monitoring` 目录
   - 复制上述组件文件到该目录

3. **添加路由**：
   ```javascript
   // router/index.js
   import { createRouter, createWebHistory } from 'vue-router';
   import ClaudeMonitoring from '../components/claude-monitoring/index.vue';

   const routes = [
     // 现有路由
     {
       path: '/claude-monitoring',
       name: 'ClaudeMonitoring',
       component: ClaudeMonitoring
     }
   ];

   const router = createRouter({
     history: createWebHistory(),
     routes
   });

   export default router;
   ```

4. **添加导航**：
   在应用的导航菜单中添加Claude监测页面的链接

### 5.2 后端集成

1. **实现API接口**：
   - 确保所有API接口都已实现
   - 测试API接口的可用性

2. **数据库初始化**：
   - 确保所有必要的数据库表都已创建
   - 测试数据库操作的正确性

3. **服务启动**：
   - 确保健康检查器和日志记录器在服务启动时初始化
   - 测试服务启动的正确性

## 6. 性能优化

1. **前端性能优化**：
   - 使用Vue的异步组件，减少初始加载时间
   - 实现数据缓存，减少重复API调用
   - 优化图表渲染，避免不必要的重绘

2. **后端性能优化**：
   - 实现数据库索引，提高查询性能
   - 优化API响应时间，减少处理时间
   - 实现批量处理，减少数据库操作次数

3. **网络优化**：
   - 使用HTTP/2，提高传输效率
   - 实现数据压缩，减少传输数据量
   - 优化API缓存策略，减少重复请求

## 7. 测试计划

1. **功能测试**：
   - 测试所有组件的功能
   - 测试API接口的可用性
   - 测试数据可视化的正确性

2. **性能测试**：
   - 测试页面加载时间
   - 测试API响应时间
   - 测试图表渲染性能

3. **兼容性测试**：
   - 测试不同浏览器的兼容性
   - 测试不同屏幕尺寸的适配性

4. **用户体验测试**：
   - 测试界面的易用性
   - 测试操作流程的流畅性
   - 测试错误处理的友好性

## 8. 结论

本实现方案通过设计合理的可视化组件，实现了Claude启动状态和启动时间的直观展示。方案充分考虑了用户体验和性能优化，确保了监测功能的可用性和可靠性。
