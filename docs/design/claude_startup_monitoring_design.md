# Claude启动状态及启动时间检测功能设计

## 1. 项目架构分析

通过对cc-switch项目的分析，确定了以下关键集成点：

### 1.1 核心文件结构
- **`src-tauri/src/proxy/health.rs`**：健康检查器，将扩展为Claude启动状态检测核心组件
- **`src-tauri/src/proxy/server.rs`**：代理服务器实现，包含启动和停止逻辑
- **`src-tauri/src/proxy/types.rs`**：类型定义，包含代理状态和健康状态结构
- **`src-tauri/src/services/proxy.rs`**：代理服务业务逻辑层

### 1.2 现有状态管理
- **`ProxyState`**：代理服务器共享状态，包含运行状态、启动时间等信息
- **`ProxyStatus`**：代理服务器状态，包含运行状态、连接数、请求统计等
- **`ProviderHealth`**：Provider健康状态，包含健康检查结果和失败统计

## 2. 设计方案

### 2.1 状态定义

```rust
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
```

### 2.2 健康检查器扩展

```rust
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
        // 实现启动过程开始逻辑
    }

    /// 标记Claude启动成功
    pub async fn mark_claude_startup_success(&self) {
        // 实现启动成功逻辑
    }

    /// 标记Claude启动失败
    pub async fn mark_claude_startup_failed(&self, reason: &str) {
        // 实现启动失败逻辑
    }

    /// 重置Claude启动状态
    pub async fn reset_claude_startup(&self) {
        // 实现状态重置逻辑
    }

    /// 获取Claude启动信息
    pub async fn get_claude_startup_info(&self) -> ClaudeStartupInfo {
        // 实现获取启动信息逻辑
    }

    /// 检查启动是否超时
    pub async fn check_startup_timeout(&self) -> bool {
        // 实现超时检查逻辑
    }
}
```

### 2.3 启动时间监测实现

1. **时间戳记录**：在启动过程开始时记录开始时间，在启动完成时记录结束时间
2. **耗时计算**：计算两个时间戳之间的差值，得到启动耗时
3. **数据存储**：将启动时间数据存储到数据库中，支持历史记录查询
4. **统计分析**：提供启动时间的统计分析功能，包括平均启动时间、最长/最短启动时间等

### 2.4 状态检测API接口

1. **健康检查接口**：扩展现有的`/health`接口，添加Claude启动状态信息
2. **状态查询接口**：扩展现有的`/status`接口，添加启动时间统计信息
3. **启动控制接口**：添加启动控制接口，允许外部系统触发启动过程

### 2.5 启动超时判断机制

1. **阈值设置**：支持配置启动超时阈值（默认30秒）
2. **超时检测**：定期检查启动过程是否超时
3. **告警处理**：当启动超时时，触发相应的告警或处理流程

### 2.6 日志记录功能

1. **启动过程日志**：记录启动过程中的关键时间节点和状态变化
2. **异常日志**：记录启动过程中出现的异常信息
3. **统计日志**：记录启动时间统计信息

### 2.7 可视化展示

1. **现有界面集成**：在现有cc-switch界面中添加启动状态和启动时间展示
2. **独立监控面板**：创建独立的监控面板，展示详细的启动状态和启动时间统计信息

## 3. 集成步骤

### 3.1 代码修改

1. **修改`proxy/health.rs`**：实现HealthChecker的完整功能
2. **修改`proxy/server.rs`**：在服务器启动和停止过程中集成启动状态检测
3. **修改`proxy/types.rs`**：添加Claude启动状态相关的类型定义
4. **修改`services/proxy.rs`**：在代理服务中集成启动时间监测功能
5. **修改`proxy/handlers.rs`**：扩展健康检查和状态查询接口

### 3.2 数据库集成

1. **创建启动时间数据表**：存储启动时间记录
2. **添加配置项**：存储启动超时阈值等配置信息

### 3.3 前端集成

1. **修改前端界面**：添加启动状态和启动时间展示
2. **添加监控面板**：创建独立的监控面板

## 4. 性能优化

1. **异步处理**：使用异步IO和并发处理，减少对主程序的性能影响
2. **缓存机制**：缓存启动状态和启动时间数据，减少数据库查询
3. **批量处理**：批量记录启动时间数据，减少数据库写入操作
4. **低优先级**：将启动状态检测设置为低优先级任务，避免影响主程序性能

## 5. 测试计划

1. **单元测试**：测试HealthChecker的各个方法
2. **集成测试**：测试启动状态检测与代理服务的集成
3. **性能测试**：测试检测功能对主程序性能的影响
4. **边界测试**：测试启动超时、网络故障等边界情况

## 6. 实现注意事项

1. **线程安全**：确保启动状态和启动时间数据的线程安全
2. **错误处理**：妥善处理启动过程中的错误情况
3. **兼容性**：确保与现有代码的兼容性
4. **可扩展性**：设计可扩展的架构，支持未来的功能扩展
5. **安全性**：确保启动状态检测功能的安全性

## 7. 结论

本设计方案通过扩展现有的HealthChecker结构，实现了Claude启动状态检测和启动时间监测功能，满足了所有要求。方案充分考虑了性能优化和系统集成，确保了检测功能对主程序的性能影响最小化。
