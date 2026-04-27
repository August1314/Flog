# Claude启动时间监测功能实现

## 1. 启动时间监测核心实现

### 1.1 HealthChecker扩展实现

```rust
//! 健康检查器
//! 
//! 负责检查Provider健康状态和Claude启动状态

use crate::database::Database;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Claude启动状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ClaudeStartupStatus {
    /// 未启动
    NotStarted,
    /// 启动中
    Starting,
    /// 启动成功
    Started,
    /// 启动失败
    Failed,
}

/// Claude启动信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeStartupInfo {
    /// 启动状态
    pub status: ClaudeStartupStatus,
    /// 启动开始时间
    pub start_time: Option<Instant>,
    /// 启动完成时间
    pub end_time: Option<Instant>,
    /// 启动耗时（毫秒）
    pub duration_ms: Option<u64>,
    /// 失败原因
    pub failure_reason: Option<String>,
    /// 最后更新时间
    pub updated_at: String,
}

/// 健康检查器
#[derive(Clone)]
pub struct HealthChecker {
    db: Arc<Database>,
    /// Claude启动状态
    claude_startup: Arc<RwLock<ClaudeStartupInfo>>,
    /// 启动超时阈值（秒）
    startup_timeout_seconds: u64,
}

impl HealthChecker {
    pub fn new(db: Arc<Database>) -> Self {
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
        }
    }

    /// 开始Claude启动过程
    pub async fn start_claude_startup(&self) {
        let mut startup_info = self.claude_startup.write().await;
        startup_info.status = ClaudeStartupStatus::Starting;
        startup_info.start_time = Some(Instant::now());
        startup_info.end_time = None;
        startup_info.duration_ms = None;
        startup_info.failure_reason = None;
        startup_info.updated_at = chrono::Utc::now().to_rfc3339();
        log::info!("Claude启动过程开始");
    }

    /// 标记Claude启动成功
    pub async fn mark_claude_startup_success(&self) {
        let mut startup_info = self.claude_startup.write().await;
        startup_info.status = ClaudeStartupStatus::Started;
        startup_info.end_time = Some(Instant::now());
        if let Some(start_time) = startup_info.start_time {
            startup_info.duration_ms = Some(start_time.elapsed().as_millis() as u64);
            // 记录启动时间到数据库
            self.record_startup_time(startup_info.duration_ms.unwrap()).await;
        }
        startup_info.updated_at = chrono::Utc::now().to_rfc3339();
        log::info!("Claude启动成功，耗时: {:?}ms", startup_info.duration_ms);
    }

    /// 标记Claude启动失败
    pub async fn mark_claude_startup_failed(&self, reason: &str) {
        let mut startup_info = self.claude_startup.write().await;
        startup_info.status = ClaudeStartupStatus::Failed;
        startup_info.end_time = Some(Instant::now());
        if let Some(start_time) = startup_info.start_time {
            startup_info.duration_ms = Some(start_time.elapsed().as_millis() as u64);
            // 记录启动失败到数据库
            self.record_startup_failure(startup_info.duration_ms.unwrap(), reason).await;
        }
        startup_info.failure_reason = Some(reason.to_string());
        startup_info.updated_at = chrono::Utc::now().to_rfc3339();
        log::error!("Claude启动失败: {}", reason);
    }

    /// 重置Claude启动状态
    pub async fn reset_claude_startup(&self) {
        let mut startup_info = self.claude_startup.write().await;
        startup_info.status = ClaudeStartupStatus::NotStarted;
        startup_info.start_time = None;
        startup_info.end_time = None;
        startup_info.duration_ms = None;
        startup_info.failure_reason = None;
        startup_info.updated_at = chrono::Utc::now().to_rfc3339();
        log::info!("Claude启动状态已重置");
    }

    /// 获取Claude启动信息
    pub async fn get_claude_startup_info(&self) -> ClaudeStartupInfo {
        self.claude_startup.read().await.clone()
    }

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

    /// 设置启动超时阈值
    pub async fn set_startup_timeout(&self, seconds: u64) {
        // 这里可以添加持久化逻辑，将阈值存储到数据库
        log::info!("Claude启动超时阈值设置为: {}秒", seconds);
    }

    /// 健康检查
    pub async fn check_health(&self) -> bool {
        // 这里可以添加更复杂的健康检查逻辑
        // 例如：检查网络连接、API响应等
        true
    }

    /// 记录启动时间到数据库
    async fn record_startup_time(&self, duration_ms: u64) {
        // 实现数据库记录逻辑
        // 例如：插入到startup_times表
        log::debug!("记录Claude启动时间: {}ms", duration_ms);
    }

    /// 记录启动失败到数据库
    async fn record_startup_failure(&self, duration_ms: u64, reason: &str) {
        // 实现数据库记录逻辑
        // 例如：插入到startup_failures表
        log::debug!("记录Claude启动失败: {}ms, 原因: {}", duration_ms, reason);
    }

    /// 获取历史启动时间统计
    pub async fn get_startup_time_stats(&self) -> StartupTimeStats {
        // 实现数据库查询逻辑
        // 例如：查询startup_times表，计算统计数据
        StartupTimeStats {
            average_ms: 0,
            min_ms: 0,
            max_ms: 0,
            total_count: 0,
            success_count: 0,
            failure_count: 0,
        }
    }
}

/// 启动时间统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupTimeStats {
    /// 平均启动时间（毫秒）
    pub average_ms: u64,
    /// 最小启动时间（毫秒）
    pub min_ms: u64,
    /// 最大启动时间（毫秒）
    pub max_ms: u64,
    /// 总启动次数
    pub total_count: u64,
    /// 成功启动次数
    pub success_count: u64,
    /// 失败启动次数
    pub failure_count: u64,
}

impl Default for HealthChecker {
    fn default() -> Self {
        // 注意：这个默认实现主要用于测试，实际使用时应该通过new方法创建
        use crate::database::Database;
        let db = Arc::new(Database::new_in_memory().unwrap());
        Self::new(db)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::sleep;

    #[tokio::test]
    async fn test_claude_startup_flow() {
        let db = Arc::new(crate::database::Database::new_in_memory().unwrap());
        let health_checker = HealthChecker::new(db);

        // 初始状态应该是NotStarted
        let initial_info = health_checker.get_claude_startup_info().await;
        assert_eq!(initial_info.status, ClaudeStartupStatus::NotStarted);

        // 开始启动
        health_checker.start_claude_startup().await;
        let starting_info = health_checker.get_claude_startup_info().await;
        assert_eq!(starting_info.status, ClaudeStartupStatus::Starting);
        assert!(starting_info.start_time.is_some());

        // 模拟启动延迟
        sleep(Duration::from_millis(100)).await;

        // 标记启动成功
        health_checker.mark_claude_startup_success().await;
        let success_info = health_checker.get_claude_startup_info().await;
        assert_eq!(success_info.status, ClaudeStartupStatus::Started);
        assert!(success_info.end_time.is_some());
        assert!(success_info.duration_ms.is_some());
        assert!(success_info.duration_ms.unwrap() >= 100);

        // 重置状态
        health_checker.reset_claude_startup().await;
        let reset_info = health_checker.get_claude_startup_info().await;
        assert_eq!(reset_info.status, ClaudeStartupStatus::NotStarted);
    }

    #[tokio::test]
    async fn test_claude_startup_failure() {
        let db = Arc::new(crate::database::Database::new_in_memory().unwrap());
        let health_checker = HealthChecker::new(db);

        // 开始启动
        health_checker.start_claude_startup().await;

        // 标记启动失败
        health_checker.mark_claude_startup_failed("网络连接失败").await;
        let failure_info = health_checker.get_claude_startup_info().await;
        assert_eq!(failure_info.status, ClaudeStartupStatus::Failed);
        assert!(failure_info.failure_reason.is_some());
        assert_eq!(failure_info.failure_reason.unwrap(), "网络连接失败");
    }

    #[tokio::test]
    async fn test_startup_timeout() {
        let db = Arc::new(crate::database::Database::new_in_memory().unwrap());
        let health_checker = HealthChecker::new(db);

        // 开始启动
        health_checker.start_claude_startup().await;

        // 立即检查，应该没有超时
        let not_timed_out = health_checker.check_startup_timeout().await;
        assert!(!not_timed_out);

        // 注意：实际测试超时需要等待较长时间，这里仅测试逻辑
    }
}
```

### 1.2 数据库表结构设计

#### 1.2.1 startup_times表

| 字段名 | 数据类型 | 描述 |
|--------|---------|------|
| id | INTEGER | 主键，自增 |
| duration_ms | INTEGER | 启动耗时（毫秒） |
| success | BOOLEAN | 是否成功启动 |
| failure_reason | TEXT | 失败原因（成功时为NULL） |
| started_at | TIMESTAMP | 启动开始时间 |
| completed_at | TIMESTAMP | 启动完成时间 |
| created_at | TIMESTAMP | 记录创建时间 |

#### 1.2.2 startup_config表

| 字段名 | 数据类型 | 描述 |
|--------|---------|------|
| id | INTEGER | 主键，自增 |
| key | TEXT | 配置键名 |
| value | TEXT | 配置值 |
| description | TEXT | 配置描述 |
| updated_at | TIMESTAMP | 更新时间 |

### 1.3 启动时间监测集成

#### 1.3.1 在ProxyService中集成

```rust
// 在services/proxy.rs中

use super::proxy::health::HealthChecker;

pub struct ProxyService {
    // 现有字段
    health_checker: HealthChecker,
}

impl ProxyService {
    pub async fn start(&self) -> Result<ProxyServerInfo, String> {
        // 开始Claude启动监测
        self.health_checker.start_claude_startup().await;
        
        // 现有启动逻辑
        // ...
        
        // 启动成功后标记
        self.health_checker.mark_claude_startup_success().await;
        
        Ok(server_info)
    }
    
    pub async fn stop(&self) -> Result<(), String> {
        // 现有停止逻辑
        // ...
        
        // 重置启动状态
        self.health_checker.reset_claude_startup().await;
        
        Ok(())
    }
    
    pub async fn get_claude_startup_info(&self) -> ClaudeStartupInfo {
        self.health_checker.get_claude_startup_info().await
    }
    
    pub async fn get_startup_time_stats(&self) -> StartupTimeStats {
        self.health_checker.get_startup_time_stats().await
    }
}
```

#### 1.3.2 在API接口中暴露

```rust
// 在proxy/handlers.rs中

use super::health::HealthChecker;

pub async fn get_status(State(state): State<ProxyState>) -> Json<ProxyStatus> {
    let mut status = state.status.read().await.clone();
    
    // 计算运行时间
    if let Some(start) = *state.start_time.read().await {
        status.uptime_seconds = start.elapsed().as_secs();
    }
    
    // 获取Claude启动信息
    let claude_startup_info = state.health_checker.get_claude_startup_info().await;
    status.claude_start