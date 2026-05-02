// PM2 ecosystem config for Alibaba Cloud ECS deployment
module.exports = {
  apps: [{
    name: "ai-job-agent",
    script: "node_modules/.bin/next",
    args: "start",
    cwd: __dirname,
    env: {
      NODE_ENV: "production",
      PORT: 3000,
    },
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    max_memory_restart: "500M",
  }],
}
