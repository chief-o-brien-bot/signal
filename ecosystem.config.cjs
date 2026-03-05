module.exports = {
  apps: [{
    name: 'signal',
    script: '/home/claude/workspace/signal/server.js',
    cwd: '/home/claude/workspace/signal',
    interpreter: '/usr/bin/node',
    env: {
      PORT: 8080,
      NODE_ENV: 'production',
    },
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    log_file: '/home/claude/workspace/logs/signal.log',
    error_file: '/home/claude/workspace/logs/signal-error.log',
    out_file: '/home/claude/workspace/logs/signal-out.log',
  }]
};
