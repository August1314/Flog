#!/bin/bash

# 测试与修正Claude Code CLI的循环流程

echo "=== Claude Code CLI 测试与修正循环流程 ==="
echo "开始时间: $(date)"
echo ""

# 循环次数
MAX_ITERATIONS=3

for ((i=1; i<=$MAX_ITERATIONS; i++)); do
  echo "=== 迭代 $i ==="
  
  # 1. 检测Claude Code CLI状态
  echo "1. 检测Claude Code CLI状态..."
  STATUS=$(curl -s "http://localhost:3001/api/claude-code-cli-status")
  
  # 解析状态信息
  INSTALLED=$(echo $STATUS | jq -r '.installed')
  VERSION=$(echo $STATUS | jq -r '.version')
  WORKING=$(echo $STATUS | jq -r '.working')
  API_KEY_SET=$(echo $STATUS | jq -r '.environment.ANTHROPIC_API_KEY')
  
  echo "   安装状态: $INSTALLED"
  echo "   版本: $VERSION"
  echo "   工作状态: $WORKING"
  echo "   ANTHROPIC_API_KEY: $API_KEY_SET"
  
  # 2. 问题识别
  echo "2. 问题识别..."
  PROBLEMS=()
  
  if [ "$INSTALLED" != "true" ]; then
    PROBLEMS+="Claude Code CLI 未安装"
  fi
  
  if [ "$WORKING" != "true" ]; then
    PROBLEMS+="Claude Code CLI 工作不正常"
  fi
  
  if [ "$API_KEY_SET" != "Set" ]; then
    PROBLEMS+="ANTHROPIC_API_KEY 未设置"
  fi
  
  if [ ${#PROBLEMS[@]} -eq 0 ]; then
    echo "   ✅ 未发现问题"
  else
    echo "   ❌ 发现问题:"
    for problem in "${PROBLEMS[@]}"; do
      echo "      - $problem"
    done
  fi
  
  # 3. 修正方案实施
  echo "3. 修正方案实施..."
  
  if [ "$INSTALLED" != "true" ]; then
    echo "   ⚠️  提示: 请安装 Claude Code CLI"
    echo "   安装命令: npm install -g @anthropic-ai/claude-code"
  fi
  
  if [ "$API_KEY_SET" != "Set" ]; then
    echo "   ⚠️  提示: 请设置 ANTHROPIC_API_KEY 环境变量"
    echo "   临时设置: export ANTHROPIC_API_KEY=your_api_key"
    echo "   永久设置: 将上述命令添加到 ~/.bashrc 或 ~/.zshrc 文件中"
  fi
  
  # 4. 验证确认
  echo "4. 验证确认..."
  if [ ${#PROBLEMS[@]} -eq 0 ]; then
    echo "   ✅ 所有测试通过"
    echo "   Claude Code CLI 运行正常"
  else
    echo "   ⚠️  部分测试未通过，请根据上述提示进行修正"
  fi
  
  echo ""
  
  # 如果所有测试通过，提前结束循环
  if [ ${#PROBLEMS[@]} -eq 0 ]; then
    echo "=== 测试完成 ==="
    echo "Claude Code CLI 已成功配置并运行正常"
    break
  fi
  
  # 等待用户修正问题
  if [ $i -lt $MAX_ITERATIONS ]; then
    echo "请根据上述提示进行修正，然后按 Enter 键继续..."
    read
  fi
done

# 如果循环结束仍有问题
if [ ${#PROBLEMS[@]} -gt 0 ]; then
  echo "=== 测试完成 ==="
  echo "❌ 部分问题未解决，请继续修正"
  echo "建议:"
  echo "1. 确保 Claude Code CLI 已正确安装"
  echo "2. 确保 ANTHROPIC_API_KEY 环境变量已设置"
  echo "3. 确保网络连接正常"
  echo "4. 尝试重新启动服务器: npm run dev"
fi

echo "结束时间: $(date)"
