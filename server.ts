const express = require("express");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");


const STARTUP_RECORDS_FILE = path.join(process.cwd(), "startup_records.json");

// ==================== StartupStatusManager ====================

class StartupStatusManager {
  status = 'NotStarted'; // 'NotStarted' | 'Starting' | 'Started' | 'Failed'
  startTime = null;
  endTime = null;
  failureReason = null;
  timeoutSeconds = 30;
  timeoutTimer = null;

  constructor() {
    if (!fs.existsSync(STARTUP_RECORDS_FILE)) {
      fs.writeFileSync(STARTUP_RECORDS_FILE, JSON.stringify([], null, 2));
    }
  }

  getStatus() {
    return {
      status: this.status,
      startTime: this.startTime ? new Date(this.startTime).toISOString() : null,
      endTime: this.endTime ? new Date(this.endTime).toISOString() : null,
      durationMs: this.startTime && this.endTime ? this.endTime - this.startTime : null,
      failureReason: this.failureReason,
      updatedAt: new Date().toISOString()
    };
  }

  start() {
    this.status = 'Starting';
    this.startTime = Date.now();
    this.endTime = null;
    this.failureReason = null;

    this.timeoutTimer = setTimeout(() => {
      if (this.status === 'Starting') {
        this.status = 'Failed';
        this.endTime = Date.now();
        this.failureReason = `启动超时（超过 ${this.timeoutSeconds} 秒）`;
        this._saveRecord(false, this.failureReason);
      }
    }, this.timeoutSeconds * 1000);

    return { success: true, message: "启动过程已开始" };
  }

  success() {
    if (this.timeoutTimer) { clearTimeout(this.timeoutTimer); this.timeoutTimer = null; }
    this.status = 'Started';
    this.endTime = Date.now();
    const durationMs = this.startTime ? this.endTime - this.startTime : 0;
    this._saveRecord(true);
    return { success: true, message: "启动成功", durationMs };
  }

  failure(reason) {
    if (this.timeoutTimer) { clearTimeout(this.timeoutTimer); this.timeoutTimer = null; }
    this.status = 'Failed';
    this.endTime = Date.now();
    this.failureReason = reason;
    this._saveRecord(false, reason);
    const durationMs = this.startTime ? this.endTime - this.startTime : 0;
    return { success: true, message: "启动失败已记录", durationMs, reason };
  }

  reset() {
    if (this.timeoutTimer) { clearTimeout(this.timeoutTimer); this.timeoutTimer = null; }
    this.status = 'NotStarted';
    this.startTime = null;
    this.endTime = null;
    this.failureReason = null;
    return { success: true, message: "启动状态已重置" };
  }

  _saveRecord(success, failureReason = null) {
    try {
      const records = JSON.parse(fs.readFileSync(STARTUP_RECORDS_FILE, 'utf8'));
      records.push({
        id: records.length + 1,
        timestamp: new Date().toISOString(),
        durationMs: this.startTime && this.endTime ? this.endTime - this.startTime : 0,
        success,
        failureReason: failureReason || null,
        startedAt: this.startTime ? new Date(this.startTime).toISOString() : null,
        completedAt: this.endTime ? new Date(this.endTime).toISOString() : null
      });
      fs.writeFileSync(STARTUP_RECORDS_FILE, JSON.stringify(records, null, 2));
    } catch (error) {
      console.error(`Error saving startup record: ${error.message}`);
    }
  }

  getHistory(limit = 10, offset = 0, successFilter) {
    try {
      let records = JSON.parse(fs.readFileSync(STARTUP_RECORDS_FILE, 'utf8'));
      if (successFilter !== undefined) records = records.filter(r => r.success === successFilter);
      return { total: records.length, records: records.slice(offset, offset + limit) };
    } catch (error) {
      return { total: 0, records: [] };
    }
  }

  getStats() {
    try {
      const records = JSON.parse(fs.readFileSync(STARTUP_RECORDS_FILE, 'utf8'));
      const successRecords = records.filter(r => r.success);
      if (successRecords.length === 0) return { averageMs: 0, minMs: 0, maxMs: 0, totalCount: records.length, successCount: 0, failureCount: records.length };
      const durations = successRecords.map(r => r.durationMs);
      return {
        averageMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        minMs: Math.min(...durations),
        maxMs: Math.max(...durations),
        totalCount: records.length,
        successCount: successRecords.length,
        failureCount: records.length - successRecords.length
      };
    } catch (error) {
      return { averageMs: 0, minMs: 0, maxMs: 0, totalCount: 0, successCount: 0, failureCount: 0 };
    }
  }

  getConfig() {
    return { startupTimeoutSeconds: this.timeoutSeconds, enableAlert: true, alertThresholdMs: 10000 };
  }

  updateConfig(config) {
    if (config.startupTimeoutSeconds !== undefined) this.timeoutSeconds = config.startupTimeoutSeconds;
    return { success: true, message: "配置已更新" };
  }
}

// ==================== AppStatusManager ====================

class AppStatusManager {
  static isAppInstalled(appName) {
    try {
      if (appName.toLowerCase() === 'trae cn') {
        return execSync(`find /Applications -name "Trae CN.app"`, { encoding: 'utf8' }).trim().length > 0;
      }
      if (appName.toLowerCase() === 'qclaw') {
        return execSync(`find /Applications -name "QClaw.app"`, { encoding: 'utf8' }).trim().length > 0;
      }
      const result = execSync(`find /Applications -name "*${appName}*.app" -o -name "*${appName.charAt(0).toUpperCase() + appName.slice(1)}*.app"`, { encoding: 'utf8' });
      return result.trim().length > 0;
    } catch (error) { return false; }
  }

  static isAppRunning(appName) {
    try {
      if (appName.toLowerCase() === 'trae cn') {
        return execSync(`pgrep -l "Trae CN"`, { encoding: 'utf8' }).trim().length > 0;
      }
      if (appName.toLowerCase() === 'qclaw') {
        return execSync(`pgrep -l "QClaw"`, { encoding: 'utf8' }).trim().length > 0;
      }
      const result = execSync(`pgrep -l -i "${appName}"`, { encoding: 'utf8' });
      return result.trim().length > 0;
    } catch (error) { return false; }
  }

  static getRunningApps() {
    try {
      const result = execSync(`osascript -e 'tell application "System Events" to get name of every process whose visible is true'`, { encoding: 'utf8' });
      return result.trim().split(', ').filter(app => app.length > 0);
    } catch (error) { return []; }
  }

  static getFrontmostApp() {
    try {
      const result = execSync(`osascript -e 'tell application "System Events" to name of (first process whose frontmost is true)'`, { encoding: 'utf8' });
      return result.trim();
    } catch (error) { return null; }
  }

  static startApp(appName) {
    try {
      execSync(`open -a "${appName}"`, { encoding: 'utf8' });
      return true;
    } catch (error) { return false; }
  }

  static async measureStartupTime(appName) {
    if (this.isAppRunning(appName)) {
      this.killApp(appName);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const startTime = Date.now();
    this.startApp(appName);
    let processStarted = false, frontmost = false, attempts = 0;
    while (attempts < 30 && (!processStarted || !frontmost)) {
      attempts++;
      if (!processStarted) processStarted = this.isAppRunning(appName);
      if (processStarted && !frontmost) {
        const frontmostApp = this.getFrontmostApp();
        if (appName.toLowerCase() === 'trae cn') frontmost = frontmostApp && frontmostApp.includes('Trae');
        else if (appName.toLowerCase() === 'qclaw') frontmost = frontmostApp && frontmostApp.includes('QClaw');
        else frontmost = frontmostApp && frontmostApp.toLowerCase().includes(appName.toLowerCase());
      }
      if (!processStarted || !frontmost) await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!processStarted) throw new Error('应用程序进程未启动');
    if (!frontmost) throw new Error('应用程序未成为前台应用');
    return Date.now() - startTime;
  }

  static killApp(appName) {
    try {
      const map = { 'trae cn': 'Trae CN', 'qclaw': 'QClaw', 'claude code': 'claude' };
      const target = map[appName.toLowerCase()] || appName;
      execSync(`pkill -f "${target}"`, { encoding: 'utf8' });
    } catch (error) {}
  }

  static isClaudeCodeCLIInstalled() {
    try { return execSync(`which claude`, { encoding: 'utf8' }).trim().length > 0; }
    catch (error) { return false; }
  }

  static getClaudeCodeCLIVersion() {
    try { return execSync(`claude --version`, { encoding: 'utf8' }).trim(); }
    catch (error) { return null; }
  }

  static testClaudeCodeCLI() {
    try { return execSync(`claude --help`, { encoding: 'utf8' }).trim().length > 0; }
    catch (error) { return false; }
  }

  static checkClaudeCodeCLIEnvironment() {
    const env = {};
    for (const v of ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL']) {
      env[v] = process.env[v] ? 'Set' : 'Not set';
    }
    return env;
  }
}

// ==================== Server ====================

function startServer() {
  const app = express();
  const PORT = 3001;
  const startupManager = new StartupStatusManager();

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // --- Existing APIs ---

  app.get("/api/active-process", (req, res) => {
    if (process.platform !== "darwin") {
      const mockApps = ["Codex", "Claude Code", "OpenClaw", "Hermes", "VS Code", "Terminal"];
      return res.json({ process: mockApps[Math.floor(Math.random() * mockApps.length)], simulated: true });
    }
    try {
      const frontmostApp = AppStatusManager.getFrontmostApp();
      return frontmostApp ? res.json({ process: frontmostApp, simulated: false }) : res.json({ process: "Unknown", error: "Failed", simulated: true });
    } catch (error) { return res.json({ process: "Unknown", error: error.message, simulated: true }); }
  });

  app.get("/api/app-installed", (req, res) => {
    const { appName } = req.query;
    if (!appName) return res.status(400).json({ error: "Missing appName parameter" });
    if (process.platform !== "darwin") return res.json({ installed: true, simulated: true });
    try { return res.json({ installed: AppStatusManager.isAppInstalled(appName), simulated: false }); }
    catch (error) { return res.json({ installed: false, error: error.message, simulated: true }); }
  });

  app.get("/api/app-running", (req, res) => {
    const { appName } = req.query;
    if (!appName) return res.status(400).json({ error: "Missing appName parameter" });
    if (process.platform !== "darwin") return res.json({ running: false, simulated: true });
    try { return res.json({ running: AppStatusManager.isAppRunning(appName), simulated: false }); }
    catch (error) { return res.json({ running: false, error: error.message, simulated: true }); }
  });

  app.get("/api/running-apps", (req, res) => {
    if (process.platform !== "darwin") return res.json({ apps: ["Codex", "Claude Code"], simulated: true });
    try { return res.json({ apps: AppStatusManager.getRunningApps(), simulated: false }); }
    catch (error) { return res.json({ apps: [], error: error.message, simulated: true }); }
  });

  app.post("/api/start-app", (req, res) => {
    const { appName } = req.query;
    if (!appName) return res.status(400).json({ error: "Missing appName parameter" });
    if (process.platform !== "darwin") return res.json({ success: true, simulated: true });
    try { return res.json({ success: AppStatusManager.startApp(appName), simulated: false }); }
    catch (error) { return res.json({ success: false, error: error.message, simulated: true }); }
  });

  app.get("/api/measure-startup-time", async (req, res) => {
    const { appName } = req.query;
    if (!appName) return res.status(400).json({ error: "Missing appName parameter" });
    if (process.platform !== "darwin") return res.json({ startupTime: 2000, simulated: true });
    try {
      const startupTime = await AppStatusManager.measureStartupTime(appName);
      return res.json({ startupTime, simulated: false });
    } catch (error) { return res.json({ startupTime: null, error: error.message, simulated: true }); }
  });

  app.get("/api/claude-code-cli-status", (req, res) => {
    if (process.platform !== "darwin") {
      return res.json({ installed: true, version: "2.1.87-dev", working: true, environment: { ANTHROPIC_API_KEY: "Set" }, simulated: true });
    }
    try {
      const installed = AppStatusManager.isClaudeCodeCLIInstalled();
      const version = installed ? AppStatusManager.getClaudeCodeCLIVersion() : null;
      const working = installed ? AppStatusManager.testClaudeCodeCLI() : false;
      const environment = AppStatusManager.checkClaudeCodeCLIEnvironment();
      return res.json({ installed, version, working, environment, simulated: false });
    } catch (error) {
      return res.json({ installed: false, version: null, working: false, environment: {}, error: error.message, simulated: true });
    }
  });

  // --- Startup APIs ---

  app.get("/api/startup/status", (req, res) => res.json(startupManager.getStatus()));
  app.post("/api/startup/start", (req, res) => res.json(startupManager.start()));
  app.post("/api/startup/success", (req, res) => res.json(startupManager.success()));
  app.post("/api/startup/failure", (req, res) => res.json(startupManager.failure(req.query.reason || "未知错误")));
  app.post("/api/startup/reset", (req, res) => res.json(startupManager.reset()));
  app.get("/api/startup/stats", (req, res) => res.json(startupManager.getStats()));
  app.get("/api/startup/history", (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const success = req.query.success !== undefined ? req.query.success === 'true' : undefined;
    res.json(startupManager.getHistory(limit, offset, success));
  });
  app.get("/api/startup/config", (req, res) => res.json(startupManager.getConfig()));
  app.put("/api/startup/config", (req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try { res.json(startupManager.updateConfig(JSON.parse(body))); }
      catch (error) { res.status(400).json({ error: "Invalid JSON" }); }
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AgentFlow Backend running on http://localhost:${PORT}`);
  });
}

if (require.main === module) startServer();
module.exports = startServer;
