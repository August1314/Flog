# Claude启动时间数据的采集、存储与展示功能实现

## 1. 数据库表结构设计

### 1.1 startup_times表

| 字段名 | 数据类型 | 约束 | 描述 |
|--------|---------|------|------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | 记录ID |
| `duration_ms` | `INTEGER` | `NOT NULL` | 启动耗时（毫秒） |
| `success` | `BOOLEAN` | `NOT NULL` | 是否成功启动 |
| `failure_reason` | `TEXT` | | 失败原因（成功时为NULL） |
| `started_at` | `TIMESTAMP` | `NOT NULL` | 启动开始时间 |
| `completed_at` | `TIMESTAMP` | `NOT NULL` | 启动完成时间 |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | 记录创建时间 |

### 1.2 startup_config表

| 字段名 | 数据类型 | 约束 | 描述 |
|--------|---------|------|------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | 配置ID |
| `key` | `TEXT` | `UNIQUE NOT NULL` | 配置键名 |
| `value` | `TEXT` | `NOT NULL` | 配置值 |
| `description` | `TEXT` | | 配置描述 |
| `updated_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | 更新时间 |

## 2. 数据采集实现

### 2.1 启动时间采集逻辑

```rust
// 在health.rs中

/// 记录启动时间到数据库
async fn record_startup_time(&self, duration_ms: u64) {
    let sql = r#"
        INSERT INTO startup_times (duration_ms, success, failure_reason, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?)
    "#;
    
    let startup_info = self.claude_startup.read().await;
    let started_at = startup_info.start_time.map(|t| {
        let duration = t.elapsed();
        chrono::Utc::now() - chrono::Duration::from_std(duration).unwrap()
    }).unwrap_or(chrono::Utc::now());
    let completed_at = chrono::Utc::now();
    
    self.db.execute(
        sql,
        &[&duration_ms, &true, &Option::<String>::None, &started_at, &completed_at]
    ).await.map_err(|e| {
        log::error!("记录启动时间失败: {}", e);
        e
    }).ok();
}

/// 记录启动失败到数据库
async fn record_startup_failure(&self, duration_ms: u64, reason: &str) {
    let sql = r#"
        INSERT INTO startup_times (duration_ms, success, failure_reason, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?)
    "#;
    
    let startup_info = self.claude_startup.read().await;
    let started_at = startup_info.start_time.map(|t| {
        let duration = t.elapsed();
        chrono::Utc::now() - chrono::Duration::from_std(duration).unwrap()
    }).unwrap_or(chrono::Utc::now());
    let completed_at = chrono::Utc::now();
    
    self.db.execute(
        sql,
        &[&duration_ms, &false, &Some(reason.to_string()), &started_at, &completed_at]
    ).await.map_err(|e| {
        log::error!("记录启动失败失败: {}", e);
        e
    }).ok();
}
```

### 2.2 配置数据采集

```rust
// 在health.rs中

/// 获取启动配置
pub async fn get_startup_config(&self) -> StartupConfig {
    let sql = r#"SELECT key, value FROM startup_config"#;
    let rows = self.db.query(sql, &[]).await.map_err(|e| {
        log::error!("获取启动配置失败: {}", e);
        e
    }).unwrap_or_default();
    
    let mut config = StartupConfig::default();
    for row in rows {
        let key: String = row.get(0).unwrap();
        let value: String = row.get(1).unwrap();
        match key.as_str() {
            "startup_timeout_seconds" => {
                if let Ok(seconds) = value.parse() {
                    config.startup_timeout_seconds = seconds;
                }
            }
            "enable_alert" => {
                if let Ok(enable) = value.parse() {
                    config.enable_alert = enable;
                }
            }
            "alert_threshold_ms" => {
                if let Ok(threshold) = value.parse() {
                    config.alert_threshold_ms = threshold;
                }
            }
            _ => {}
        }
    }
    
    config
}

/// 更新启动配置
pub async fn update_startup_config(&self, config: &StartupConfig) -> Result<(), String> {
    let sql = r#"
        INSERT OR REPLACE INTO startup_config (key, value, description, updated_at)
        VALUES (?, ?, ?, ?)
    "#;
    
    let configs = vec![
        ("startup_timeout_seconds", config.startup_timeout_seconds.to_string(), "启动超时阈值（秒）"),
        ("enable_alert", config.enable_alert.to_string(), "是否启用告警"),
        ("alert_threshold_ms", config.alert_threshold_ms.to_string(), "告警阈值（毫秒）"),
    ];
    
    for (key, value, description) in configs {
        self.db.execute(
            sql,
            &[&key, &value, &description, &chrono::Utc::now()]
        ).await.map_err(|e| format!("更新配置失败: {}", e))?;
    }
    
    Ok(())
}

/// 启动配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StartupConfig {
    /// 启动超时阈值（秒）
    pub startup_timeout_seconds: u64,
    /// 是否启用告警
    pub enable_alert: bool,
    /// 告警阈值（毫秒）
    pub alert_threshold_ms: u64,
}

impl Default for StartupConfig {
    fn default() -> Self {
        Self {
            startup_timeout_seconds: 30,
            enable_alert: true,
            alert_threshold_ms: 10000,
        }
    }
}
```

## 3. 数据存储实现

### 3.1 数据库初始化

```rust
// 在database.rs中添加初始化函数

pub async fn init_startup_tables(&self) -> Result<(), rusqlite::Error> {
    // 创建startup_times表
    self.conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS startup_times (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            duration_ms INTEGER NOT NULL,
            success BOOLEAN NOT NULL,
            failure_reason TEXT,
            started_at TIMESTAMP NOT NULL,
            completed_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        "#,
        []
    )?;
    
    // 创建startup_config表
    self.conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS startup_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT NOT NULL,
            description TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        "#,
        []
    )?;
    
    // 插入默认配置
    self.conn.execute(
        r#"
        INSERT OR IGNORE INTO startup_config (key, value, description, updated_at)
        VALUES (?, ?, ?, ?)
        "#,
        &["startup_timeout_seconds", "30", "启动超时阈值（秒）", chrono::Utc::now()]
    )?;
    
    self.conn.execute(
        r#"
        INSERT OR IGNORE INTO startup_config (key, value, description, updated_at)
        VALUES (?, ?, ?, ?)
        "#,
        &["enable_alert", "true", "是否启用告警", chrono::Utc::now()]
    )?;
    
    self.conn.execute(
        r#"
        INSERT OR IGNORE INTO startup_config (key, value, description, updated_at)
        VALUES (?, ?, ?, ?)
        "#,
        &["alert_threshold_ms", "10000", "告警阈值（毫秒）", chrono::Utc::now()]
    )?;
    
    Ok(())
}
```

### 3.2 数据查询实现

```rust
// 在health.rs中

/// 获取启动时间统计
pub async fn get_startup_time_stats(&self) -> StartupTimeStats {
    let sql = r#"
        SELECT
            AVG(duration_ms) as avg_ms,
            MIN(duration_ms) as min_ms,
            MAX(duration_ms) as max_ms,
            COUNT(*) as total_count,
            SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failure_count
        FROM startup_times
    "#;
    
    let row = self.db.query_row(sql, &[], |row| {
        Ok(StartupTimeStats {
            average_ms: row.get::<_, Option<f64>>(0)?.unwrap_or(0.0) as u64,
            min_ms: row.get::<_, Option<u64>>(1)?.unwrap_or(0),
            max_ms: row.get::<_, Option<u64>>(2)?.unwrap_or(0),
            total_count: row.get::<_, Option<u64>>(3)?.unwrap_or(0),
            success_count: row.get::<_, Option<u64>>(4)?.unwrap_or(0),
            failure_count: row.get::<_, Option<u64>>(5)?.unwrap_or(0),
        })
    }).await.map_err(|e| {
        log::error!("获取启动时间统计失败: {}", e);
        e
    }).unwrap_or_default();
    
    row
}

/// 获取启动时间历史
pub async fn get_startup_time_history(&self, limit: u32, offset: u32, success: Option<bool>) -> (u64, Vec<StartupTimeRecord>) {
    let mut sql = r#"
        SELECT id, duration_ms, success, failure_reason, started_at, completed_at
        FROM startup_times
    "#;
    
    let mut params: Vec<rusqlite::types::ToSql> = vec![];
    
    if let Some(success_val) = success {
        sql += " WHERE success = ?";
        params.push(success_val.into());
    }
    
    sql += " ORDER BY started_at DESC LIMIT ? OFFSET ?";
    params.push(limit.into());
    params.push(offset.into());
    
    let rows = self.db.query(&sql, &params).await.map_err(|e| {
        log::error!("获取启动时间历史失败: {}", e);
        e
    }).unwrap_or_default();
    
    let mut records = vec![];
    for row in rows {
        let record = StartupTimeRecord {
            id: row.get(0).unwrap(),
            duration_ms: row.get(1).unwrap(),
            success: row.get(2).unwrap(),
            failure_reason: row.get(3).unwrap(),
            started_at: row.get(4).unwrap(),
            completed_at: row.get(5).unwrap(),
        };
        records.push(record);
    }
    
    // 获取总记录数
    let count_sql = if success.is_some() {
        "SELECT COUNT(*) FROM startup_times WHERE success = ?"
    } else {
        "SELECT COUNT(*) FROM startup_times"
    };
    
    let count_params = if let Some(success_val) = success {
        vec![success_val.into()]
    } else {
        vec![]
    };
    
    let total = self.db.query_row(count_sql, &count_params, |row| {
        row.get::<_, u64>(0)
    }).await.map_err(|e| {
        log::error!("获取启动时间历史总数失败: {}", e);
        e
    }).unwrap_or(0);
    
    (total, records)
}

/// 启动时间记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupTimeRecord {
    /// 记录ID
    pub id: u64,
    /// 启动耗时（毫秒）
    pub duration_ms: u64,
    /// 是否成功启动
    pub success: bool,
    /// 失败原因
    pub failure_reason: Option<String>,
    /// 启动开始时间
    pub started_at: chrono::DateTime<chrono::Utc>,
    /// 启动完成时间
    pub completed_at: chrono::DateTime<chrono::Utc>,
}
```

## 4. 数据展示功能

### 4.1 API接口实现

```rust
// 在handlers.rs中

/// 获取启动时间统计
pub async fn get_startup_time_stats(State(state): State<ProxyState>) -> Json<StartupTimeStats> {
    let stats = state.health_checker.get_startup_time_stats().await;
    Json(stats)
}

/// 获取启动时间历史
pub async fn get_startup_time_history(
    State(state): State<ProxyState>,
    Query(params): Query<HashMap<String, String>>
) -> Json<serde_json::Value> {
    let limit = params.get("limit").and_then(|v| v.parse().ok()).unwrap_or(10);
    let offset = params.get("offset").and_then(|v| v.parse().ok()).unwrap_or(0);
    let success = params.get("success").and_then(|v| v.parse().ok());
    
    let (total, records) = state.health_checker.get_startup_time_history(limit, offset, success).await;
    
    Json(serde_json::json!({"total": total, "records": records}))
}

/// 获取启动配置
pub async fn get_startup_config(State(state): State<ProxyState>) -> Json<StartupConfig> {
    let config = state.health_checker.get_startup_config().await;
    Json(config)
}

/// 更新启动配置
pub async fn update_startup_config(
    State(state): State<ProxyState>,
    Json(config): Json<StartupConfig>
) -> Json<serde_json::Value> {
    match state.health_checker.update_startup_config(&config).await {
        Ok(_) => Json(serde_json::json!({"success": true, "message": "启动配置已更新"})),
        Err(e) => Json(serde_json::json!({"success": false, "message": e})),
    }
}
```

### 4.2 前端展示组件设计

#### 4.2.1 启动状态卡片

```vue
<template>
  <div class="startup-status-card">
    <h3>Claude启动状态</h3>
    <div class="status-indicator" :class="statusClass">{{ statusText }}</div>
    <div v-if="startupInfo" class="startup-details">
      <div class="detail-item">
        <span class="label">启动耗时:</span>
        <span class="value">{{ startupInfo.duration_ms }}ms</span>
      </div>
      <div class="detail-item">
        <span class="label">开始时间:</span>
        <span class="value">{{ formatTime(startupInfo.start_time) }}</span>
      </div>
      <div class="detail-item">
        <span class="label">完成时间:</span>
        <span class="value">{{ formatTime(startupInfo.end_time) }}</span>
      </div>
      <div v-if="startupInfo.failure_reason" class="detail-item error">
        <span class="label">失败原因:</span>
        <span class="value">{{ startupInfo.failure_reason }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const startupInfo = ref(null);

const getStatusClass = () => {
  if (!startupInfo.value) return 'unknown';
  switch (startupInfo.value.status) {
    case 'NotStarted': return 'not-started';
    case 'Starting': return 'starting';
    case 'Started': return 'started';
    case 'Failed': return 'failed';
    default: return 'unknown';
  }
};

const getStatusText = () => {
  if (!startupInfo.value) return '未知';
  switch (startupInfo.value.status) {
    case 'NotStarted': return '未启动';
    case 'Starting': return '启动中';
    case 'Started': return '启动成功';
    case 'Failed': return '启动失败';
    default: return '未知';
  }
};

const formatTime = (time) => {
  if (!time) return 'N/A';
  return new Date(time).toLocaleString();
};

const fetchStartupStatus = async () => {
  try {
    const response = await fetch('/claude/startup/status');
    const data = await response.json();
    startupInfo.value = data;
  } catch (error) {
    console.error('获取启动状态失败:', error);
  }
};

onMounted(() => {
  fetchStartupStatus();
  // 每5秒刷新一次
  setInterval(fetchStartupStatus, 5000);
});
</script>

<style scoped>
.startup-status-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 18px;
  color: #333;
}

.status-indicator {
  display: inline-block;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: bold;
  margin-bottom: 16px;
}

.status-indicator.not-started {
  background-color: #e9ecef;
  color: #6c757d;
}

.status-indicator.starting {
  background-color: #fff3cd;
  color: #856404;
}

.status-indicator.started {
  background-color: #d4edda;
  color: #155724;
}

.status-indicator.failed {
  background-color: #f8d7da;
  color: #721c24;
}

.startup-details {
  margin-top: 16px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 4px 0;
  border-bottom: 1px solid #e9ecef;
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
</style>
```

#### 4.2.2 启动时间统计图表

```vue
<template>
  <div class="startup-stats-card">
    <h3>启动时间统计</h3>
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-value">{{ stats.average_ms }}ms</div>
        <div class="stat-label">平均启动时间</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ stats.min_ms }}ms</div>
        <div class="stat-label">最短启动时间</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ stats.max_ms }}ms</div>
        <div class="stat-label">最长启动时间</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ stats.total_count }}</div>
        <div class="stat-label">总启动次数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ stats.success_count }}</div>
        <div class="stat-label">成功次数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ stats.failure_count }}</div>
        <div class="stat-label">失败次数</div>
      </div>
    </div>
    <div class="chart-container">
      <canvas ref="chartCanvas"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import Chart from 'chart.js/auto';

const stats = ref({
  average_ms: 0,
  min_ms: 0,
  max_ms: 0,
  total_count: 0,
  success_count: 0,
  failure_count: 0
});

const chartCanvas = ref(null);
let chart = null;

const fetchStartupStats = async () => {
  try {
    const response = await fetch('/claude/startup/stats');
    const data = await response.json();
    stats.value = data;
  } catch (error) {
    console.error('获取启动统计失败:', error);
  }
};

const fetchStartupHistory = async () => {
  try {
    const response = await fetch('/claude/startup/history?limit=20');
    const data = await response.json();
    updateChart(data.records);
  } catch (error) {
    console.error('获取启动历史失败:', error);
  }
};

const updateChart = (records) => {
  if (!chartCanvas.value) return;
  
  const labels = records.map(record => {
    return new Date(record.started_at).toLocaleString();
  }).reverse();
  
  const data = records.map(record => record.duration_ms).reverse();
  
  const backgroundColors = records.map(record => {
    return record.success ? 'rgba(75, 192, 192, 0.6)' : 'rgba(255, 99, 132, 0.6)';
  }).reverse();
  
  if (chart) {
    chart.destroy();
  }
  
  chart = new Chart(chartCanvas.value, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '启动耗时 (ms)',
        data: data,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors.map(color => color.replace('0.6', '1')),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: '耗时 (ms)'
          }
        },
        x: {
          title: {
            display: true,
            text: '启动时间'
          }
        }
      }
    }
  });
};

onMounted(() => {
  fetchStartupStats();
  fetchStartupHistory();
  // 每30秒刷新一次
  setInterval(() => {
    fetchStartupStats();
    fetchStartupHistory();
  }, 30000);
});
</script>

<style scoped>
.startup-stats-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 18px;
  color: #333;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-item {
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #6c757d;
}

.chart-container {
  height: 300px;
  margin-top: 24px;
}
</style>
```

#### 4.2.3 启动配置表单

```vue
<template>
  <div class="startup-config-card">
    <h3>启动配置</h3>
    <form @submit.prevent="saveConfig">
      <div class="form-group">
        <label for="startupTimeout">启动超时阈值（秒）</label>
        <input
          type="number"
          id="startupTimeout"
          v-model.number="config.startup_timeout_seconds"
          min="1"
          max="300"
          required
        />
      </div>
      <div class="form-group">
        <label for="enableAlert">启用告警</label>
        <input
          type="checkbox"
          id="enableAlert"
          v-model="config.enable_alert"
        />
      </div>
      <div class="form-group">
        <label for="alertThreshold">告警阈值（毫秒）</label>
        <input
          type="number"
          id="alertThreshold"
          v-model.number="config.alert_threshold_ms"
          min="1000"
          max="60000"
          required
        />
      </div>
      <button type="submit" class="btn btn-primary">保存配置</button>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const config = ref({
  startup_timeout_seconds: 30,
  enable_alert: true,
  alert_threshold_ms: 10000
});

const fetchConfig = async () => {
  try {
    const response = await fetch('/claude/startup/config');
    const data = await response.json();
    config.value = data;
  } catch (error) {
    console.error('获取启动配置失败:', error);
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
    console.error('保存启动配置失败:', error);
    alert('配置保存失败');
  }
};

onMounted(() => {
  fetchConfig();
});
</script>

<style scoped>
.startup-config-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 18px;
  color: #333;
}

.form-group {
  margin-bottom: 16px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

input[type="number"] {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

input[type="checkbox"] {
  margin-right: 8px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
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

## 5. 集成步骤

### 5.1 后端集成

1. **修改`database.rs`**：添加初始化启动表的函数
2. **修改`health.rs`**：实现数据采集和存储逻辑
3. **修改`handlers.rs`**：实现API接口
4. **修改`server.rs`**：注册API路由

### 5.2 前端集成

1. **添加启动状态卡片**：在主界面添加Claude启动状态展示
2. **添加启动时间统计图表**：展示启动时间统计数据
3. **添加启动配置表单**：允许用户配置启动参数
4. **添加监控面板**：创建独立的监控页面

## 6. 性能优化

1. **缓存机制**：缓存启动统计数据，减少数据库查询
2. **批量处理**：批量插入启动记录，减少数据库写入操作
3. **分页查询**：对历史记录使用分页，避免返回大量数据
4. **异步处理**：使用异步IO处理数据采集和存储

## 7. 测试计划

1. **单元测试**：测试数据采集和存储逻辑
2. **集成测试**：测试API与数据库的集成
3. **性能测试**：测试数据存储和查询性能
4. **边界测试**：测试大量数据情况下的性能

## 8. 结论

本实现方案通过设计合理的数据库表结构，实现了Claude启动时间数据的采集、存储与展示功能。方案充分考虑了性能优化和用户体验，确保了数据的准确性和展示的直观性。
