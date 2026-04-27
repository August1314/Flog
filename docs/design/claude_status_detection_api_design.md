# Claude状态检测API接口设计

## 1. 现有API接口分析

通过对cc-switch项目的分析，发现以下现有API接口：

### 1.1 健康检查接口
- **路径**：`/health`
- **方法**：GET
- **功能**：检查代理服务器健康状态
- **响应**：简单的健康状态信息

### 1.2 状态查询接口
- **路径**：`/status`
- **方法**：GET
- **功能**：获取代理服务器状态信息
- **响应**：包含运行状态、连接数、请求统计等信息

## 2. 新API接口设计

### 2.1 Claude启动状态接口

#### 2.1.1 获取Claude启动状态
- **路径**：`/claude/startup/status`
- **方法**：GET
- **功能**：获取Claude启动状态和启动时间信息
- **响应**：
  ```json
  {
    "status": "Started", // NotStarted, Starting, Started, Failed
    "start_time": "2024-04-26T12:00:00Z",
    "end_time": "2024-04-26T12:00:05Z",
    "duration_ms": 5000,
    "failure_reason": null,
    "updated_at": "2024-04-26T12:00:05Z"
  }
  ```

#### 2.1.2 开始Claude启动过程
- **路径**：`/claude/startup/start`
- **方法**：POST
- **功能**：开始Claude启动过程，重置启动状态并开始计时
- **响应**：
  ```json
  {
    "success": true,
    "message": "Claude启动过程已开始"
  }
  ```

#### 2.1.3 标记Claude启动成功
- **路径**：`/claude/startup/success`
- **方法**：POST
- **功能**：标记Claude启动成功，记录结束时间和耗时
- **响应**：
  ```json
  {
    "success": true,
    "message": "Claude启动成功",
    "duration_ms": 5000
  }
  ```

#### 2.1.4 标记Claude启动失败
- **路径**：`/claude/startup/failure`
- **方法**：POST
- **请求体**：
  ```json
  {
    "reason": "网络连接失败"
  }
  ```
- **功能**：标记Claude启动失败，记录结束时间、耗时和失败原因
- **响应**：
  ```json
  {
    "success": true,
    "message": "Claude启动失败已记录",
    "duration_ms": 3000,
    "reason": "网络连接失败"
  }
  ```

#### 2.1.5 重置Claude启动状态
- **路径**：`/claude/startup/reset`
- **方法**：POST
- **功能**：重置Claude启动状态
- **响应**：
  ```json
  {
    "success": true,
    "message": "Claude启动状态已重置"
  }
  ```

### 2.2 启动时间统计接口

#### 2.2.1 获取启动时间统计
- **路径**：`/claude/startup/stats`
- **方法**：GET
- **功能**：获取Claude启动时间统计信息
- **响应**：
  ```json
  {
    "average_ms": 4500,
    "min_ms": 3000,
    "max_ms": 8000,
    "total_count": 10,
    "success_count": 8,
    "failure_count": 2
  }
  ```

#### 2.2.2 获取启动时间历史
- **路径**：`/claude/startup/history`
- **方法**：GET
- **查询参数**：
  - `limit`：返回记录数量，默认10
  - `offset`：偏移量，默认0
  - `success`：是否只返回成功记录，默认null（全部）
- **功能**：获取Claude启动时间历史记录
- **响应**：
  ```json
  {
    "total": 10,
    "records": [
      {
        "id": 1,
        "duration_ms": 5000,
        "success": true,
        "failure_reason": null,
        "started_at": "2024-04-26T12:00:00Z",
        "completed_at": "2024-04-26T12:00:05Z"
      },
      {
        "id": 2,
        "duration_ms": 3000,
        "success": false,
        "failure_reason": "网络连接失败",
        "started_at": "2024-04-26T11:00:00Z",
        "completed_at": "2024-04-26T11:00:03Z"
      }
    ]
  }
  ```

### 2.3 启动配置接口

#### 2.3.1 获取启动配置
- **路径**：`/claude/startup/config`
- **方法**：GET
- **功能**：获取Claude启动配置
- **响应**：
  ```json
  {
    "startup_timeout_seconds": 30,
    "enable_alert": true,
    "alert_threshold_ms": 10000
  }
  ```

#### 2.3.2 更新启动配置
- **路径**：`/claude/startup/config`
- **方法**：PUT
- **请求体**：
  ```json
  {
    "startup_timeout_seconds": 45,
    "enable_alert": true,
    "alert_threshold_ms": 15000
  }
  ```
- **功能**：更新Claude启动配置
- **响应**：
  ```json
  {
    "success": true,
    "message": "启动配置已更新"
  }
  ```

## 3. API实现方案

### 3.1 扩展ProxyState

```rust
// 在proxy/server.rs中

use super::health::HealthChecker;

#[derive(Clone)]
pub struct ProxyState {
    // 现有字段
    pub health_checker: Arc<HealthChecker>,
}

impl ProxyState {
    pub fn new(db: Arc<Database>, app_handle: Option<tauri::AppHandle>) -> Self {
        // 现有初始化逻辑
        let health_checker = Arc::new(HealthChecker::new(db.clone()));
        
        Self {
            // 现有字段
            health_checker,
        }
    }
}
```

### 3.2 实现API处理函数

```rust
// 在proxy/handlers.rs中

use super::health::{ClaudeStartupStatus, ClaudeStartupInfo, StartupTimeStats};

/// 获取Claude启动状态
pub async fn get_claude_startup_status(State(state): State<ProxyState>) -> Json<ClaudeStartupInfo> {
    let startup_info = state.health_checker.get_claude_startup_info().await;
    Json(startup_info)
}

/// 开始Claude启动过程
pub async fn start_claude_startup(State(state): State<ProxyState>) -> Json<serde_json::Value> {
    state.health_checker.start_claude_startup().await;
    Json(serde_json::json!({"success": true, "message": "Claude启动过程已开始"}))
}

/// 标记Claude启动成功
pub async fn mark_claude_startup_success(State(state): State<ProxyState>) -> Json<serde_json::Value> {
    state.health_checker.mark_claude_startup_success().await;
    let startup_info = state.health_checker.get_claude_startup_info().await;
    Json(serde_json::json!({"success": true, "message": "Claude启动成功", "duration_ms": startup_info.duration_ms}))
}

/// 标记Claude启动失败
pub async fn mark_claude_startup_failure(
    State(state): State<ProxyState>,
    Json(payload): Json<serde_json::Value>
) -> Json<serde_json::Value> {
    let reason = payload.get("reason").and_then(|v| v.as_str()).unwrap_or("未知错误");
    state.health_checker.mark_claude_startup_failed(reason).await;
    let startup_info = state.health_checker.get_claude_startup_info().await;
    Json(serde_json::json!({"success": true, "message": "Claude启动失败已记录", "duration_ms": startup_info.duration_ms, "reason": reason}))
}

/// 重置Claude启动状态
pub async fn reset_claude_startup(State(state): State<ProxyState>) -> Json<serde_json::Value> {
    state.health_checker.reset_claude_startup().await;
    Json(serde_json::json!({"success": true, "message": "Claude启动状态已重置"}))
}

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
    // 实现历史记录查询逻辑
    let limit = params.get("limit").and_then(|v| v.parse().ok()).unwrap_or(10);
    let offset = params.get("offset").and_then(|v| v.parse().ok()).unwrap_or(0);
    let success = params.get("success").and_then(|v| v.parse().ok());
    
    // 模拟数据
    let records = vec![];
    let total = 0;
    
    Json(serde_json::json!({"total": total, "records": records}))
}

/// 获取启动配置
pub async fn get_startup_config(State(state): State<ProxyState>) -> Json<serde_json::Value> {
    // 实现配置获取逻辑
    Json(serde_json::json!({
        "startup_timeout_seconds": 30,
        "enable_alert": true,
        "alert_threshold_ms": 10000
    }))
}

/// 更新启动配置
pub async fn update_startup_config(
    State(state): State<ProxyState>,
    Json(payload): Json<serde_json::Value>
) -> Json<serde_json::Value> {
    // 实现配置更新逻辑
    if let Some(timeout) = payload.get("startup_timeout_seconds").and_then(|v| v.as_u64()) {
        state.health_checker.set_startup_timeout(timeout).await;
    }
    Json(serde_json::json!({"success": true, "message": "启动配置已更新"}))
}
```

### 3.3 注册API路由

```rust
// 在proxy/server.rs的build_router方法中

fn build_router(&self) -> Router {
    Router::new()
        // 现有路由
        .route("/health", get(handlers::health_check))
        .route("/status", get(handlers::get_status))
        // Claude启动状态接口
        .route("/claude/startup/status", get(handlers::get_claude_startup_status))
        .route("/claude/startup/start", post(handlers::start_claude_startup))
        .route("/claude/startup/success", post(handlers::mark_claude_startup_success))
        .route("/claude/startup/failure", post(handlers::mark_claude_startup_failure))
        .route("/claude/startup/reset", post(handlers::reset_claude_startup))
        // 启动时间统计接口
        .route("/claude/startup/stats", get(handlers::get_startup_time_stats))
        .route("/claude/startup/history", get(handlers::get_startup_time_history))
        // 启动配置接口
        .route("/claude/startup/config", get(handlers::get_startup_config))
        .route("/claude/startup/config", put(handlers::update_startup_config))
        // 其他现有路由
        .layer(DefaultBodyLimit::max(200 * 1024 * 1024))
        .with_state(self.state.clone())
}
```

### 3.4 扩展ProxyStatus

```rust
// 在proxy/types.rs中

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProxyStatus {
    // 现有字段
    /// Claude启动状态
    pub claude_startup_status: Option<ClaudeStartupInfo>,
}

// 更新get_status方法
pub async fn get_status(&self) -> ProxyStatus {
    let mut status = self.state.status.read().await.clone();
    
    // 现有逻辑
    
    // 获取Claude启动信息
    let claude_startup_info = self.state.health_checker.get_claude_startup_info().await;
    status.claude_startup_status = Some(claude_startup_info);
    
    status
}
```

## 4. 集成步骤

### 4.1 代码修改

1. **修改`proxy/health.rs`**：实现完整的HealthChecker功能
2. **修改`proxy/types.rs`**：添加Claude启动状态相关类型
3. **修改`proxy/server.rs`**：扩展ProxyState和ProxyStatus
4. **修改`proxy/handlers.rs`**：实现新的API处理函数
5. **修改`services/proxy.rs`**：集成HealthChecker到ProxyService

### 4.2 前端集成

1. **添加API调用**：在前端代码中添加对新API的调用
2. **更新状态展示**：在前端界面中展示Claude启动状态和启动时间
3. **添加监控面板**：创建独立的监控面板，展示详细的启动状态和启动时间统计信息

## 5. 安全性考虑

1. **认证授权**：考虑添加API认证机制，防止未授权访问
2. **输入验证**：对API输入进行验证，防止恶意输入
3. **Rate Limiting**：添加速率限制，防止API滥用
4. **日志记录**：记录API访问日志，便于审计和故障排查

## 6. 性能优化

1. **缓存机制**：缓存启动状态和统计信息，减少数据库查询
2. **异步处理**：使用异步IO处理API请求，提高并发性能
3. **批量处理**：批量获取历史记录，减少数据库查询次数
4. **分页机制**：对历史记录查询使用分页，避免返回大量数据

## 7. 测试计划

1. **单元测试**：测试API处理函数的正确性
2. **集成测试**：测试API与HealthChecker的集成
3. **性能测试**：测试API的响应时间和并发性能
4. **边界测试**：测试API的边界情况和错误处理

## 8. 结论

本设计方案通过扩展现有的API接口，实现了Claude启动状态检测和启动时间监测的完整功能。方案充分考虑了安全性、性能和可扩展性，确保了API接口的可靠性和易用性。
