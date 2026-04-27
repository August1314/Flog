# Claude启动超时判断机制实现

## 1. 超时判断逻辑设计

### 1.1 超时检测机制

```rust
// 在health.rs中

/// 检查启动是否超时
pub async fn check_startup_timeout(&self) -> bool {
    let startup_info = self.claude_startup.read().await;
    if startup_info.status == ClaudeStartupStatus::Starting {
        if let Some(start_time) = startup_info.start_time {
            return start_time.elapsed() > Duration::from_secs(self.startup_timeout_seconds);
        }
    }
    false
}

/// 启动超时检查任务
pub async fn start_timeout_check_task(&self) {
    let self_clone = self.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(1)).await;
            
            // 检查是否超时
            if self_clone.check_startup_timeout().await {
                // 处理超时
                self_clone.handle_startup_timeout().await;
            }
        }
    });
}

/// 处理启动超时
async fn handle_startup_timeout(&self) {
    let mut startup_info = self.claude_startup.write().await;
    if startup_info.status == ClaudeStartupStatus::Starting {
        startup_info.status = ClaudeStartupStatus::Failed;
        startup_info.end_time = Some(Instant::now());
        if let Some(start_time) = startup_info.start_time {
            startup_info.duration_ms = Some(start_time.elapsed().as_millis() as u64);
            // 记录启动失败到数据库
            self.record_startup_failure(startup_info.duration_ms.unwrap(), "启动超时").await;
        }
        startup_info.failure_reason = Some("启动超时".to_string());
        startup_info.updated_at = chrono::Utc::now().to_rfc3339();
        
        log::error!("Claude启动超时");
        
        // 触发告警
        self.trigger_alert("启动超时", "Claude启动过程超过预设阈值").await;
    }
}
```

### 1.2 阈值设置管理

```rust
// 在health.rs中

/// 设置启动超时阈值
pub async fn set_startup_timeout(&self, seconds: u64) {
    let mut config = self.get_startup_config().await;
    config.startup_timeout_seconds = seconds;
    self.update_startup_config(&config).await.unwrap_or_else(|e| {
        log::error!("更新启动超时阈值失败: {}", e);
    });
    
    // 更新内存中的阈值
    // 注意：这里需要添加代码来更新内存中的startup_timeout_seconds值
    log::info!("Claude启动超时阈值设置为: {}秒", seconds);
}

/// 获取启动超时阈值
pub async fn get_startup_timeout(&self) -> u64 {
    let config = self.get_startup_config().await;
    config.startup_timeout_seconds
}
```

## 2. 告警处理机制

### 2.1 告警触发逻辑

```rust
// 在health.rs中

/// 触发告警
async fn trigger_alert(&self, title: &str, message: &str) {
    let config = self.get_startup_config().await;
    if !config.enable_alert {
        return;
    }
    
    // 记录告警到数据库
    self.record_alert(title, message).await;
    
    // 发送系统通知
    self.send_system_notification(title, message).await;
    
    // 发送日志告警
    log::warn!("[告警] {}: {}", title, message);
}

/// 记录告警到数据库
async fn record_alert(&self, title: &str, message: &str) {
    let sql = r#"
        INSERT INTO alerts (title, message, created_at)
        VALUES (?, ?, ?)
    "#;
    
    self.db.execute(
        sql,
        &[&title, &message, &chrono::Utc::now()]
    ).await.map_err(|e| {
        log::error!("记录告警失败: {}", e);
        e
    }).ok();
}

/// 发送系统通知
async fn send_system_notification(&self, title: &str, message: &str) {
    // 这里可以实现系统通知逻辑
    // 例如：使用tauri的通知API发送桌面通知
    // 或者使用其他通知服务
    log::info!("发送系统通知: {} - {}", title, message);
}
```

### 2.2 告警阈值管理

```rust
// 在health.rs中

/// 设置告警阈值
pub async fn set_alert_threshold(&self, threshold_ms: u64) {
    let mut config = self.get_startup_config().await;
    config.alert_threshold_ms = threshold_ms;
    self.update_startup_config(&config).await.unwrap_or_else(|e| {
        log::error!("更新告警阈值失败: {}", e);
    });
    
    log::info!("Claude启动告警阈值设置为: {}毫秒", threshold_ms);
}

/// 检查是否需要触发启动时间告警
pub async fn check_alert_threshold(&self, duration_ms: u64) {
    let config = self.get_startup_config().await;
    if !config.enable_alert {
        return;
    }
    
    if duration_ms > config.alert_threshold_ms {
        self.trigger_alert(
            "启动时间过长",
            &format!("Claude启动时间为{}毫秒，超过告警阈值{}毫秒", duration_ms, config.alert_threshold_ms)
        ).await;
    }
}
```

### 2.3 告警表结构

| 字段名 | 数据类型 | 约束 | 描述 |
|--------|---------|------|------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | 告警ID |
| `title` | `TEXT` | `NOT NULL` | 告警标题 |
| `message` | `TEXT` | `NOT NULL` | 告警消息 |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | 告警时间 |
| `acknowledged` | `BOOLEAN` | `DEFAULT FALSE` | 是否已确认 |
| `acknowledged_at` | `TIMESTAMP` | | 确认时间 |

## 3. 实现细节

### 3.1 数据库初始化

```rust
// 在database.rs中

pub async fn init_alert_table(&self) -> Result<(), rusqlite::Error> {
    // 创建alerts表
    self.conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            acknowledged BOOLEAN DEFAULT FALSE,
            acknowledged_at TIMESTAMP
        )
        "#,
        []
    )?;
    
    Ok(())
}
```

### 3.2 超时检查任务启动

```rust
// 在server.rs中

pub async fn start(&self) -> Result<ProxyServerInfo, ProxyError> {
    // 现有启动逻辑
    
    // 启动超时检查任务
    self.state.health_checker.start_timeout_check_task().await;
    
    // 其他启动逻辑
    
    Ok(server_info)
}
```

### 3.3 启动成功后的告警检查

```rust
// 在health.rs中

/// 标记Claude启动成功
pub async fn mark_claude_startup_success(&self) {
    let mut startup_info = self.claude_startup.write().await;
    startup_info.status = ClaudeStartupStatus::Started;
    startup_info.end_time = Some(Instant::now());
    if let Some(start_time) = startup_info.start_time {
        let duration_ms = start_time.elapsed().as_millis() as u64;
        startup_info.duration_ms = Some(duration_ms);
        // 记录启动时间到数据库
        self.record_startup_time(duration_ms).await;
        // 检查是否需要触发告警
        self.check_alert_threshold(duration_ms).await;
    }
    startup_info.updated_at = chrono::Utc::now().to_rfc3339();
    log::info!("Claude启动成功，耗时: {:?}ms", startup_info.duration_ms);
}
```

## 4. API接口扩展

### 4.1 告警相关API

#### 4.1.1 获取告警列表
- **路径**：`/claude/alerts`
- **方法**：GET
- **查询参数**：
  - `limit`：返回记录数量，默认10
  - `offset`：偏移量，默认0
  - `acknowledged`：是否只返回已确认的告警，默认null（全部）
- **功能**：获取告警历史记录
- **响应**：
  ```json
  {
    "total": 5,
    "records": [
      {
        "id": 1,
        "title": "启动超时",
        "message": "Claude启动过程超过预设阈值",
        "created_at": "2024-04-26T12:00:00Z",
        "acknowledged": false,
        "acknowledged_at": null
      }
    ]
  }
  ```

#### 4.1.2 确认告警
- **路径**：`/claude/alerts/{id}/acknowledge`
- **方法**：POST
- **功能**：确认告警
- **响应**：
  ```json
  {
    "success": true,
    "message": "告警已确认"
  }
  ```

### 4.2 告警API实现

```rust
// 在handlers.rs中

/// 获取告警列表
pub async fn get_alerts(
    State(state): State<ProxyState>,
    Query(params): Query<HashMap<String, String>>
) -> Json<serde_json::Value> {
    let limit = params.get("limit").and_then(|v| v.parse().ok()).unwrap_or(10);
    let offset = params.get("offset").and_then(|v| v.parse().ok()).unwrap_or(0);
    let acknowledged = params.get("acknowledged").and_then(|v| v.parse().ok());
    
    // 实现告警查询逻辑
    let (total, records) = state.health_checker.get_alerts(limit, offset, acknowledged).await;
    
    Json(serde_json::json!({"total": total, "records": records}))
}

/// 确认告警
pub async fn acknowledge_alert(
    State(state): State<ProxyState>,
    Path((id,)): Path<(u64,)>
) -> Json<serde_json::Value> {
    match state.health_checker.acknowledge_alert(id).await {
        Ok(_) => Json(serde_json::json!({"success": true, "message": "告警已确认"})),
        Err(e) => Json(serde_json::json!({"success": false, "message": e})),
    }
}
```

## 5. 前端集成

### 5.1 告警展示组件

```vue
<template>
  <div class="alerts-card">
    <h3>告警记录</h3>
    <div v-if="alerts.length === 0" class="no-alerts">
      暂无告警记录
    </div>
    <div v-else class="alert-list">
      <div v-for="alert in alerts" :key="alert.id" class="alert-item" :class="{ 'unacknowledged': !alert.acknowledged }">
        <div class="alert-header">
          <div class="alert-title">{{ alert.title }}</div>
          <div class="alert-time">{{ formatTime(alert.created_at) }}</div>
        </div>
        <div class="alert-message">{{ alert.message }}</div>
        <div class="alert-actions">
          <button v-if="!alert.acknowledged" @click="acknowledgeAlert(alert.id)" class="btn btn-sm btn-primary">
            确认
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const alerts = ref([]);

const formatTime = (time) => {
  if (!time) return 'N/A';
  return new Date(time).toLocaleString();
};

const fetchAlerts = async () => {
  try {
    const response = await fetch('/claude/alerts');
    const data = await response.json();
    alerts.value = data.records;
  } catch (error) {
    console.error('获取告警记录失败:', error);
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
      fetchAlerts();
    }
  } catch (error) {
    console.error('确认告警失败:', error);
  }
};

onMounted(() => {
  fetchAlerts();
  // 每30秒刷新一次
  setInterval(fetchAlerts, 30000);
});
</script>

<style scoped>
.alerts-card {
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

.no-alerts {
  text-align: center;
  padding: 32px;
  color: #6c757d;
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alert-item {
  background: white;
  padding: 12px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #6c757d;
}

.alert-item.unacknowledged {
  border-left-color: #dc3545;
  background-color: #f8d7da;
}

.alert-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.alert-title {
  font-weight: bold;
  color: #333;
}

.alert-time {
  font-size: 12px;
  color: #6c757d;
}

.alert-message {
  margin-bottom: 12px;
  color: #333;
}

.alert-actions {
  display: flex;
  justify-content: flex-end;
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
</style>
```

## 6. 集成步骤

### 6.1 后端集成

1. **修改`database.rs`**：添加初始化告警表的函数
2. **修改`health.rs`**：实现超时判断和告警处理逻辑
3. **修改`handlers.rs`**：实现告警相关API接口
4. **修改`server.rs`**：注册告警API路由并启动超时检查任务

### 6.2 前端集成

1. **添加告警展示组件**：在监控面板中添加告警记录展示
2. **添加告警确认功能**：允许用户确认告警
3. **添加告警通知**：在前端显示实时告警通知

## 7. 性能优化

1. **异步处理**：使用异步IO处理告警和超时检查
2. **批量处理**：批量处理告警记录，减少数据库操作
3. **缓存机制**：缓存告警配置，减少数据库查询
4. **节流机制**：对告警通知进行节流，避免过多通知

## 8. 测试计划

1. **单元测试**：测试超时判断和告警处理逻辑
2. **集成测试**：测试超时检查任务和告警系统的集成
3. **边界测试**：测试不同超时阈值下的行为
4. **性能测试**：测试超时检查任务对系统性能的影响

## 9. 结论

本实现方案通过设计合理的超时判断机制和告警处理流程，实现了Claude启动超时的检测和处理。方案充分考虑了性能优化和用户体验，确保了系统的可靠性和可维护性。
