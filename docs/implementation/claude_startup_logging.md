# Claude启动过程日志记录功能实现

## 1. 日志系统设计

### 1.1 日志级别定义

| 级别 | 描述 | 使用场景 |
|------|------|----------|
| `DEBUG` | 详细的调试信息 | 开发和调试过程 |
| `INFO` | 一般信息 | 正常操作流程 |
| `WARN` | 警告信息 | 可能的问题 |
| `ERROR` | 错误信息 | 错误情况 |
| `FATAL` | 致命错误 | 系统崩溃等严重问题 |

### 1.2 日志结构设计

```rust
/// 启动日志记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupLog {
    /// 日志ID
    pub id: u64,
    /// 日志级别
    pub level: String,
    /// 日志消息
    pub message: String,
    /// 时间戳
    pub timestamp: chrono::DateTime<chrono::Utc>,
    /// 启动会话ID
    pub session_id: String,
    /// 附加信息
    pub metadata: Option<serde_json::Value>,
}

/// 启动会话
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupSession {
    /// 会话ID
    pub id: String,
    /// 启动开始时间
    pub start_time: chrono::DateTime<chrono::Utc>,
    /// 启动结束时间
    pub end_time: Option<chrono::DateTime<chrono::Utc>>,
    /// 启动状态
    pub status: ClaudeStartupStatus,
    /// 启动耗时（毫秒）
    pub duration_ms: Option<u64>,
    /// 失败原因
    pub failure_reason: Option<String>,
}
```

## 2. 日志记录实现

### 2.1 日志记录器

```rust
// 在health.rs中

use log::{debug, error, info, trace, warn};

/// 日志记录器
#[derive(Clone)]
pub struct StartupLogger {
    db: Arc<Database>,
    current_session_id: Arc<RwLock<Option<String>>>,
}

impl StartupLogger {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            db,
            current_session_id: Arc::new(RwLock::new(None)),
        }
    }

    /// 开始新的启动会话
    pub async fn start_session(&self) -> String {
        let session_id = uuid::Uuid::new_v4().to_string();
        *self.current_session_id.write().await = Some(session_id.clone());
        
        // 记录会话开始
        let sql = r#"
            INSERT INTO startup_sessions (id, start_time, status)
            VALUES (?, ?, ?)
        "#;
        
        self.db.execute(
            sql,
            &[&session_id, &chrono::Utc::now(), &"Starting"]
        ).await.map_err(|e| {
            error!("记录启动会话失败: {}", e);
            e
        }).ok();
        
        // 记录日志
        self.log(LogLevel::Info, "启动会话开始", None).await;
        
        session_id
    }

    /// 结束启动会话
    pub async fn end_session(&self, status: ClaudeStartupStatus, duration_ms: Option<u64>, failure_reason: Option<&str>) {
        let session_id = self.current_session_id.read().await.clone();
        if let Some(session_id) = session_id {
            let sql = r#"
                UPDATE startup_sessions
                SET end_time = ?, status = ?, duration_ms = ?, failure_reason = ?
                WHERE id = ?
            "#;
            
            self.db.execute(
                sql,
                &[
                    &chrono::Utc::now(),
                    &format!("{:?}", status),
                    &duration_ms,
                    &failure_reason.map(|s| s.to_string()),
                    &session_id
                ]
            ).await.map_err(|e| {
                error!("更新启动会话失败: {}", e);
                e
            }).ok();
            
            // 记录日志
            let message = match status {
                ClaudeStartupStatus::Started => format!("启动成功，耗时: {:?}ms", duration_ms),
                ClaudeStartupStatus::Failed => format!("启动失败: {:?}", failure_reason),
                _ => format!("启动会话结束，状态: {:?}", status),
            };
            self.log(LogLevel::Info, &message, None).await;
        }
    }

    /// 记录日志
    pub async fn log(&self, level: LogLevel, message: &str, metadata: Option<serde_json::Value>) {
        let session_id = self.current_session_id.read().await.clone().unwrap_or_else(|| "unknown".to_string());
        
        // 记录到数据库
        let sql = r#"
            INSERT INTO startup_logs (level, message, timestamp, session_id, metadata)
            VALUES (?, ?, ?, ?, ?)
        "#;
        
        self.db.execute(
            sql,
            &[&format!("{:?}", level), &message, &chrono::Utc::now(), &session_id, &metadata]
        ).await.map_err(|e| {
            error!("记录日志失败: {}", e);
            e
        }).ok();
        
        // 记录到系统日志
        match level {
            LogLevel::Debug => debug!("[Claude启动] {}", message),
            LogLevel::Info => info!("[Claude启动] {}", message),
            LogLevel::Warn => warn!("[Claude启动] {}", message),
            LogLevel::Error => error!("[Claude启动] {}", message),
            LogLevel::Fatal => error!("[Claude启动] [FATAL] {}", message),
        }
    }

    /// 获取当前会话ID
    pub async fn get_current_session_id(&self) -> Option<String> {
        self.current_session_id.read().await.clone()
    }

    /// 获取会话日志
    pub async fn get_session_logs(&self, session_id: &str) -> Vec<StartupLog> {
        let sql = r#"
            SELECT id, level, message, timestamp, session_id, metadata
            FROM startup_logs
            WHERE session_id = ?
            ORDER BY timestamp ASC
        "#;
        
        let rows = self.db.query(sql, &[session_id]).await.map_err(|e| {
            error!("获取会话日志失败: {}", e);
            e
        }).unwrap_or_default();
        
        let mut logs = vec![];
        for row in rows {
            let log = StartupLog {
                id: row.get(0).unwrap(),
                level: row.get(1).unwrap(),
                message: row.get(2).unwrap(),
                timestamp: row.get(3).unwrap(),
                session_id: row.get(4).unwrap(),
                metadata: row.get(5).unwrap(),
            };
            logs.push(log);
        }
        
        logs
    }

    /// 获取所有启动会话
    pub async fn get_all_sessions(&self, limit: u32, offset: u32) -> (u64, Vec<StartupSession>) {
        // 实现获取会话列表逻辑
        (0, vec![])
    }
}

/// 日志级别
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
    Fatal,
}
```

### 2.2 数据库表结构

#### 2.2.1 startup_logs表

| 字段名 | 数据类型 | 约束 | 描述 |
|--------|---------|------|------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | 日志ID |
| `level` | `TEXT` | `NOT NULL` | 日志级别 |
| `message` | `TEXT` | `NOT NULL` | 日志消息 |
| `timestamp` | `TIMESTAMP` | `NOT NULL` | 时间戳 |
| `session_id` | `TEXT` | `NOT NULL` | 启动会话ID |
| `metadata` | `TEXT` | | 附加信息（JSON格式） |

#### 2.2.2 startup_sessions表

| 字段名 | 数据类型 | 约束 | 描述 |
|--------|---------|------|------|
| `id` | `TEXT` | `PRIMARY KEY` | 会话ID（UUID） |
| `start_time` | `TIMESTAMP` | `NOT NULL` | 启动开始时间 |
| `end_time` | `TIMESTAMP` | | 启动结束时间 |
| `status` | `TEXT` | `NOT NULL` | 启动状态 |
| `duration_ms` | `INTEGER` | | 启动耗时（毫秒） |
| `failure_reason` | `TEXT` | | 失败原因 |

### 2.3 数据库初始化

```rust
// 在database.rs中

pub async fn init_log_tables(&self) -> Result<(), rusqlite::Error> {
    // 创建startup_logs表
    self.conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS startup_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            level TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            session_id TEXT NOT NULL,
            metadata TEXT
        )
        "#,
        []
    )?;
    
    // 创建startup_sessions表
    self.conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS startup_sessions (
            id TEXT PRIMARY KEY,
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP,
            status TEXT NOT NULL,
            duration_ms INTEGER,
            failure_reason TEXT
        )
        "#,
        []
    )?;
    
    Ok(())
}
```

## 3. 日志记录集成

### 3.1 在HealthChecker中集成

```rust
// 在health.rs中

/// 健康检查器
#[derive(Clone)]
pub struct HealthChecker {
    db: Arc<Database>,
    /// Claude启动状态
    claude_startup: Arc<RwLock<ClaudeStartupInfo>>,
    /// 启动超时阈值（秒）
    startup_timeout_seconds: u64,
    /// 日志记录器
    logger: Arc<StartupLogger>,
}

impl HealthChecker {
    pub fn new(db: Arc<Database>) -> Self {
        let logger = Arc::new(StartupLogger::new(db.clone()));
        
        Self {
            db,
            claude_startup: Arc::new(RwLock::new(ClaudeStartupInfo {
                status: ClaudeStartupStatus::NotStarted,
                start_time: None,
                end_time: None,
                duration_ms: None,
                failure_reason: None,
                updated_at: chrono::Utc::now().to_rfc3339(),
            })),
            startup_timeout_seconds: 30, // 默认30秒超时
            logger,
        }
    }

    /// 开始Claude启动过程
    pub async fn start_claude_startup(&self) {
        // 开始新的会话
        self.logger.start_session().await;
        
        let mut startup_info = self.claude_startup.write().await;
        startup_info.status = ClaudeStartupStatus::Starting;
        startup_info.start_time = Some(Instant::now());
        startup_info.end_time = None;
        startup_info.duration_ms = None;
        startup_info.failure_reason = None;
        startup_info.updated_at = chrono::Utc::now().to_rfc3339();
        
        // 记录日志
        self.logger.log(LogLevel::Info, "Claude启动过程开始", None).await;
    }

    /// 标记Claude启动成功
    pub async fn mark_claude_startup_success(&self) {
        let mut startup_info = self.claude_startup.write().await;
        startup_info.status = ClaudeStartupStatus::Started;
        startup_info.end_time = Some(Instant::now());
        
        let duration_ms = if let Some(start_time) = startup_info.start_time {
            let duration = start_time.elapsed().as_millis() as u64;
            startup_info.duration_ms = Some(duration);
            // 记录启动时间到数据库
            self.record_startup_time(duration).await;
            // 检查是否需要触发告警
            self.check_alert_threshold(duration).await;
            duration
        } else {
            0
        };
        
        startup_info.updated_at = chrono::Utc::now().to_rfc3339();
        
        // 记录日志
        self.logger.log(
            LogLevel::Info,
            &format!("Claude启动成功，耗时: {}ms", duration_ms),
            None
        ).await;
        
        // 结束会话
        self.logger.end_session(ClaudeStartupStatus::Started, Some(duration_ms), None).await;
    }

    /// 标记Claude启动失败
    pub async fn mark_claude_startup_failed(&self, reason: &str) {
        let mut startup_info = self.claude_startup.write().await;
        startup_info.status = ClaudeStartupStatus::Failed;
        startup_info.end_time = Some(Instant::now());
        
        let duration_ms = if let Some(start_time) = startup_info.start_time {
            let duration = start_time.elapsed().as_millis() as u64;
            startup_info.duration_ms = Some(duration);
            // 记录启动失败到数据库
            self.record_startup_failure(duration, reason).await;
            duration
        } else {
            0
        };
        
        startup_info.failure_reason = Some(reason.to_string());
        startup_info.updated_at = chrono::Utc::now().to_rfc3339();
        
        // 记录日志
        self.logger.log(
            LogLevel::Error,
            &format!("Claude启动失败: {}", reason),
            Some(serde_json::json!({"duration_ms": duration_ms}))
        ).await;
        
        // 结束会话
        self.logger.end_session(ClaudeStartupStatus::Failed, Some(duration_ms), Some(reason)).await;
    }

    // 其他方法...
}
```

## 4. API接口扩展

### 4.1 日志相关API

#### 4.1.1 获取启动会话列表
- **路径**：`/claude/startup/sessions`
- **方法**：GET
- **查询参数**：
  - `limit`：返回记录数量，默认10
  - `offset`：偏移量，默认0
- **功能**：获取启动会话列表
- **响应**：
  ```json
  {
    "total": 5,
    "records": [
      {
        "id": "session-123",
        "start_time": "2024-04-26T12:00:00Z",
        "end_time": "2024-04-26T12:00:05Z",
        "status": "Started",
        "duration_ms": 5000,
        "failure_reason": null
      }
    ]
  }
  ```

#### 4.1.2 获取会话日志
- **路径**：`/claude/startup/sessions/{id}/logs`
- **方法**：GET
- **功能**：获取指定会话的详细日志
- **响应**：
  ```json
  {
    "session_id": "session-123",
    "logs": [
      {
        "id": 1,
        "level": "Info",
        "message": "启动会话开始",
        "timestamp": "2024-04-26T12:00:00Z",
        "metadata": null
      },
      {
        "id": 2,
        "level": "Info",
        "message": "Claude启动成功，耗时: 5000ms",
        "timestamp": "2024-04-26T12:00:05Z",
        "metadata": null
      }
    ]
  }
  ```

### 4.2 日志API实现

```rust
// 在handlers.rs中

/// 获取启动会话列表
pub async fn get_startup_sessions(
    State(state): State<ProxyState>,
    Query(params): Query<HashMap<String, String>>
) -> Json<serde_json::Value> {
    let limit = params.get("limit").and_then(|v| v.parse().ok()).unwrap_or(10);
    let offset = params.get("offset").and_then(|v| v.parse().ok()).unwrap_or(0);
    
    let (total, sessions) = state.health_checker.get_all_sessions(limit, offset).await;
    
    Json(serde_json::json!({"total": total, "records": sessions}))
}

/// 获取会话日志
pub async fn get_session_logs(
    State(state): State<ProxyState>,
    Path((session_id,)): Path<(String,)>
) -> Json<serde_json::Value> {
    let logs = state.health_checker.get_session_logs(&session_id).await;
    
    Json(serde_json::json!({"session_id": session_id, "logs": logs}))
}
```

## 5. 前端集成

### 5.1 启动会话列表组件

```vue
<template>
  <div class="sessions-card">
    <h3>启动会话记录</h3>
    <div class="session-list">
      <div v-for="session in sessions" :key="session.id" class="session-item" :class="statusClass(session.status)">
        <div class="session-header">
          <div class="session-status">{{ statusText(session.status) }}</div>
          <div class="session-time">{{ formatTime(session.start_time) }}</div>
        </div>
        <div class="session-details">
          <div class="detail-item">
            <span class="label">耗时:</span>
            <span class="value">{{ session.duration_ms }}ms</span>
          </div>
          <div v-if="session.failure_reason" class="detail-item error">
            <span class="label">失败原因:</span>
            <span class="value">{{ session.failure_reason }}</span>
          </div>
        </div>
        <div class="session-actions">
          <button @click="viewSessionLogs(session.id)" class="btn btn-sm btn-primary">
            查看日志
          </button>
        </div>
      </div>
    </div>
    <div class="pagination">
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
  if (!time) return 'N/A';
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
.sessions-card {
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

.session-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.session-item {
  background: white;
  padding: 12px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #6c757d;
}

.session-item.not-started {
  border-left-color: #6c757d;
}

.session-item.starting {
  border-left-color: #ffc107;
}

.session-item.started {
  border-left-color: #28a745;
}

.session-item.failed {
  border-left-color: #dc3545;
  background-color: #f8d7da;
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.session-status {
  font-weight: bold;
  color: #333;
}

.session-time {
  font-size: 12px;
  color: #6c757d;
}

.session-details {
  margin-bottom: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 14px;
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

.session-actions {
  display: flex;
  justify-content: flex-end;
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

### 5.2 会话日志详情组件

```vue
<template>
  <div class="session-logs-card">
    <h3>会话日志详情</h3>
    <div class="session-info">
      <div class="info-item">
        <span class="label">会话ID:</span>
        <span class="value">{{ sessionId }}</span>
      </div>
    </div>
    <div class="logs-list">
      <div v-for="log in logs" :key="log.id" class="log-item" :class="log.level.toLowerCase()">
        <div class="log-header">
          <div class="log-level">{{ log.level }}</div>
          <div class="log-time">{{ formatTime(log.timestamp) }}</div>
        </div>
        <div class="log-message">{{ log.message }}</div>
        <div v-if="log.metadata" class="log-metadata">
          <pre>{{ JSON.stringify(log.metadata, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps } from 'vue';

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
});

const logs = ref([]);

const formatTime = (time) => {
  if (!time) return 'N/A';
  return new Date(time).toLocaleString();
};

const fetchSessionLogs = async () => {
  try {
    const response = await fetch(`/claude/startup/sessions/${props.sessionId}/logs`);
    const data = await response.json();
    logs.value = data.logs;
  } catch (error) {
    console.error('获取会话日志失败:', error);
  }
};

onMounted(() => {
  fetchSessionLogs();
});
</script>

<style scoped>
.session-logs-card {
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

.session-info {
  background: white;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.label {
  font-weight: 500;
  color: #6c757d;
}

.value {
  color: #333;
  font-family: monospace;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-item {
  background: white;
  padding: 12px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #6c757d;
}

.log-item.debug {
  border-left-color: #17a2b8;
  background-color: #e3f2fd;
}

.log-item.info {
  border-left-color: #28a745;
  background-color: #d4edda;
}

.log-item.warn {
  border-left-color: #ffc107;
  background-color: #fff3cd;
}

.log-item.error {
  border-left-color: #dc3545;
  background-color: #f8d7da;
}

.log-item.fatal {
  border-left-color: #6f42c1;
  background-color: #f3e5f5;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.log-level {
  font-weight: bold;
  text-transform: uppercase;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background-color: rgba(0, 0, 0, 0.1);
}

.log-time {
  font-size: 12px;
  color: #6c757d;
}

.log-message {
  margin-bottom: 8px;
  color: #333;
}

.log-metadata {
  background: rgba(0, 0, 0, 0.05);
  padding: 8px;
  border-radius: 4px;
  margin-top: 8px;
}

.log-metadata pre {
  margin: 0;
  font-size: 12px;
  color: #6c757d;
  overflow-x: auto;
}
</style>
```

## 6. 集成步骤

### 6.1 后端集成

1. **修改`database.rs`**：添加初始化日志表的函数
2. **修改`health.rs`**：实现日志记录器和日志记录逻辑
3. **修改`handlers.rs`**：实现日志相关API接口
4. **修改`server.rs`**：注册日志API路由

### 6.2 前端集成

1. **添加启动会话列表组件**：在监控面板中添加会话记录展示
2. **添加会话日志详情组件**：展示详细的启动过程日志
3. **添加日志过滤功能**：允许按级别和时间过滤日志

## 7. 性能优化

1. **异步处理**：使用异步IO处理日志记录
2. **批量处理**：批量写入日志，减少数据库操作
3. **缓存机制**：缓存最近的日志，减少数据库查询
4. **日志轮转**：定期清理旧日志，避免数据库膨胀

## 8. 测试计划

1. **单元测试**：测试日志记录器的各个方法
2. **集成测试**：测试日志系统与健康检查器的集成
3. **性能测试**：测试日志记录对系统性能的影响
4. **边界测试**：测试大量日志情况下的性能

## 9. 结论

本实现方案通过设计合理的日志系统，实现了Claude启动过程的详细日志记录。方案充分考虑了性能优化和用户体验，确保了日志记录的完整性和可追溯性。
