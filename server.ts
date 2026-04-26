const express = require("express");
const { exec } = require("child_process");
const path = require("path");

// 更可靠的方式获取当前目录
const __dirname = path.resolve();

async function startServer() {
  const app = express();
  const PORT = 3001; // 更改端口，避免与Vite冲突

  // 允许跨域
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // Endpoint to detect the active frontmost process
  app.get("/api/active-process", (req, res) => {
    // macOS command to get the name of the frontmost application
    const macCommand = `osascript -e 'tell application "System Events" to name of (first process whose frontmost is true)'`;
    
    // Linux command (might not work in headless containers, but here for completeness)
    const linuxCommand = `xdotool getwindowfocus getwindowname`;

    const command = process.platform === "darwin" ? macCommand : null;

    if (!command) {
      // Fallback/Simulation for non-macOS environments (like Cloud Run)
      const mockApps = ["Codex", "Claude Code", "OpenClaw", "Hermes", "VS Code", "Terminal", "System Settings", "Vibe Coding"];
      const randomApp = mockApps[Math.floor(Math.random() * mockApps.length)];
      return res.json({ process: randomApp, simulated: true });
    }

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing process detection: ${error.message}`);
        // Fallback to simulation if command fails (common in restricted envs)
        const mockApps = ["Codex", "Claude Code", "OpenClaw", "Hermes", "VS Code", "Terminal", "Vibe Coding"];
        const randomApp = mockApps[Math.floor(Math.random() * mockApps.length)];
        return res.json({ process: randomApp, error: error.message, simulated: true });
      }
      res.json({ process: stdout.trim(), simulated: false });
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AgentFlow Backend running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = startServer;
