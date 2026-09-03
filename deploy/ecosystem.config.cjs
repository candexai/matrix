// pm2 process definitions for Matrix × CandexAI
module.exports = {
  apps: [
    {
      name: "matrix-backend",
      cwd: "/opt/matrix/backend",
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "600M",
      env: { NODE_ENV: "production" },
      out_file: "/var/log/matrix/backend.out.log",
      error_file: "/var/log/matrix/backend.err.log",
      merge_logs: true,
      time: true,
    },
    {
      name: "matrix-frontend",
      cwd: "/opt/matrix/frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 127.0.0.1",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "700M",
      env: { NODE_ENV: "production", PORT: "3000" },
      out_file: "/var/log/matrix/frontend.out.log",
      error_file: "/var/log/matrix/frontend.err.log",
      merge_logs: true,
      time: true,
    },
  ],
};
