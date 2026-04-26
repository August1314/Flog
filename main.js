const { app, BrowserWindow } = require("electron");
const path = require("path");
const express = require("./server.cjs");

// 保持对窗口对象的全局引用，防止JavaScript垃圾回收时窗口被自动关闭
let mainWindow;

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // 加载应用的index.html
  mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));

  // 打开开发者工具
  // mainWindow.webContents.openDevTools();

  // 窗口关闭时触发
  mainWindow.on("closed", function () {
    // 取消引用窗口对象，通常如果应用支持多窗口，会把所有窗口对象存放在一个数组中
    mainWindow = null;
  });
}

// Electron完成初始化并准备创建浏览器窗口时触发
app.on("ready", createWindow);

// 所有窗口关闭时退出应用
app.on("window-all-closed", function () {
  // 在macOS上，除非用户用Cmd+Q明确退出，否则应用和菜单栏会保持激活
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", function () {
  // 在macOS上，点击dock图标重新创建窗口
  if (mainWindow === null) createWindow();
});
