const express = require("express");
const { execSync, exec } = require("child_process");
const path = require("path");

// 使用更可靠的方式获取当前目录，避免重复声明__dirname
if (typeof __dirname === "undefined") {
  global.__dirname = path.resolve();
}

// 应用程序状态管理类
class AppStatusManager {
  // 检查应用程序是否安装
  static isAppInstalled(appName) {
    try {
      // 处理特殊情况：Trae CN应用
      if (appName.toLowerCase() === "trae cn") {
        const result = execSync(`find /Applications -name "Trae CN.app"`, {
          encoding: "utf8",
        });
        return result.trim().length > 0;
      }

      // 处理特殊情况：QClaw应用
      if (appName.toLowerCase() === "qclaw") {
        const result = execSync(`find /Applications -name "QClaw.app"`, {
          encoding: "utf8",
        });
        return result.trim().length > 0;
      }

      // 使用find命令检查应用程序是否存在（忽略大小写）
      const result = execSync(
        `find /Applications -name "*${appName}*.app" -o -name "*${appName.charAt(0).toUpperCase() + appName.slice(1)}*.app"`,
        {
          encoding: "utf8",
        },
      );
      return result.trim().length > 0;
    } catch (error) {
      console.error(
        `Error checking if ${appName} is installed: ${error.message}`,
      );
      return false;
    }
  }

  // 检查应用程序是否正在运行
  static isAppRunning(appName) {
    try {
      // 处理特殊情况：Trae CN应用
      if (appName.toLowerCase() === "trae cn") {
        const result = execSync(`pgrep -l "Trae CN"`, { encoding: "utf8" });
        return result.trim().length > 0;
      }

      // 处理特殊情况：QClaw应用
      if (appName.toLowerCase() === "qclaw") {
        const result = execSync(`pgrep -l "QClaw"`, { encoding: "utf8" });
        return result.trim().length > 0;
      }

      // 使用pgrep命令检查进程是否存在（忽略大小写）
      const result = execSync(`pgrep -l -i "${appName}"`, { encoding: "utf8" });
      return result.trim().length > 0;
    } catch (error) {
      console.error(
        `Error checking if ${appName} is running: ${error.message}`,
      );
      return false;
    }
  }

  // 获取所有正在运行的应用程序
  static getRunningApps() {
    try {
      // 使用osascript命令获取所有正在运行的应用程序
      const result = execSync(
        `osascript -e 'tell application "System Events" to get name of every process whose visible is true'`,
        { encoding: "utf8" },
      );
      return result
        .trim()
        .split(", ")
        .filter((app) => app.length > 0);
    } catch (error) {
      console.error(`Error getting running apps: ${error.message}`);
      return [];
    }
  }

  // 获取当前前台应用程序
  static getFrontmostApp() {
    try {
      // 使用osascript命令获取当前前台应用程序
      const result = execSync(
        `osascript -e 'tell application "System Events" to name of (first process whose frontmost is true)'`,
        { encoding: "utf8" },
      );
      return result.trim();
    } catch (error) {
      console.error(`Error getting frontmost app: ${error.message}`);
      return null;
    }
  }

  // 启动应用程序
  static startApp(appName) {
    try {
      // 使用open命令启动应用程序
      execSync(`open -a "${appName}"`, { encoding: "utf8" });
      return true;
    } catch (error) {
      console.error(`Error starting ${appName}: ${error.message}`);
      return false;
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3001; // 更改端口，避免与Vite冲突

  // 允许跨域
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  // Endpoint to detect the active frontmost process
  app.get("/api/active-process", (req, res) => {
    if (process.platform !== "darwin") {
      // Fallback/Simulation for non-macOS environments (like Cloud Run)
      const mockApps = [
        "Codex",
        "Claude Code",
        "OpenClaw",
        "Hermes",
        "VS Code",
        "Terminal",
        "System Settings",
        "Vibe Coding",
        "trae cn",
      ];
      const randomApp = mockApps[Math.floor(Math.random() * mockApps.length)];
      return res.json({ process: randomApp, simulated: true });
    }

    try {
      const frontmostApp = AppStatusManager.getFrontmostApp();
      if (frontmostApp) {
        return res.json({ process: frontmostApp, simulated: false });
      } else {
        // Fallback to simulation if command fails
        const mockApps = [
          "Codex",
          "Claude Code",
          "OpenClaw",
          "Hermes",
          "VS Code",
          "Terminal",
          "Vibe Coding",
          "trae cn",
        ];
        const randomApp = mockApps[Math.floor(Math.random() * mockApps.length)];
        return res.json({
          process: randomApp,
          error: "Failed to get frontmost app",
          simulated: true,
        });
      }
    } catch (error) {
      console.error(`Error executing process detection: ${error.message}`);
      // Fallback to simulation if command fails
      const mockApps = [
        "Codex",
        "Claude Code",
        "OpenClaw",
        "Hermes",
        "VS Code",
        "Terminal",
        "Vibe Coding",
        "trae cn",
      ];
      const randomApp = mockApps[Math.floor(Math.random() * mockApps.length)];
      return res.json({
        process: randomApp,
        error: error.message,
        simulated: true,
      });
    }
  });

  // Endpoint to check if an app is installed
  app.get("/api/app-installed", (req, res) => {
    const { appName } = req.query;

    if (!appName) {
      return res.status(400).json({ error: "Missing appName parameter" });
    }

    if (process.platform !== "darwin") {
      // Fallback for non-macOS environments
      return res.json({ installed: true, simulated: true });
    }

    try {
      const installed = AppStatusManager.isAppInstalled(appName);
      return res.json({ installed, simulated: false });
    } catch (error) {
      console.error(`Error checking app installation: ${error.message}`);
      return res.json({
        installed: false,
        error: error.message,
        simulated: true,
      });
    }
  });

  // Endpoint to check if an app is running
  app.get("/api/app-running", (req, res) => {
    const { appName } = req.query;

    if (!appName) {
      return res.status(400).json({ error: "Missing appName parameter" });
    }

    if (process.platform !== "darwin") {
      // Fallback for non-macOS environments
      return res.json({ running: false, simulated: true });
    }

    try {
      const running = AppStatusManager.isAppRunning(appName);
      return res.json({ running, simulated: false });
    } catch (error) {
      console.error(`Error checking app running status: ${error.message}`);
      return res.json({
        running: false,
        error: error.message,
        simulated: true,
      });
    }
  });

  // Endpoint to get all running apps
  app.get("/api/running-apps", (req, res) => {
    if (process.platform !== "darwin") {
      // Fallback for non-macOS environments
      const mockApps = [
        "Codex",
        "Claude Code",
        "OpenClaw",
        "Hermes",
        "VS Code",
        "Terminal",
      ];
      return res.json({ apps: mockApps, simulated: true });
    }

    try {
      const apps = AppStatusManager.getRunningApps();
      return res.json({ apps, simulated: false });
    } catch (error) {
      console.error(`Error getting running apps: ${error.message}`);
      // Fallback to mock data
      const mockApps = [
        "Codex",
        "Claude Code",
        "OpenClaw",
        "Hermes",
        "VS Code",
        "Terminal",
      ];
      return res.json({
        apps: mockApps,
        error: error.message,
        simulated: true,
      });
    }
  });

  // Endpoint to start an app
  app.post("/api/start-app", (req, res) => {
    const { appName } = req.query;

    if (!appName) {
      return res.status(400).json({ error: "Missing appName parameter" });
    }

    if (process.platform !== "darwin") {
      // Fallback for non-macOS environments
      return res.json({ success: true, simulated: true });
    }

    try {
      const success = AppStatusManager.startApp(appName);
      return res.json({ success, simulated: false });
    } catch (error) {
      console.error(`Error starting app: ${error.message}`);
      return res.json({
        success: false,
        error: error.message,
        simulated: true,
      });
    }
  });

  // 静态文件服务
  const distPath = path.join(path.resolve(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AgentFlow Backend running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = startServer;
