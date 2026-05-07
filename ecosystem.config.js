'use strict';

// PM2 process manager configuration.
// Usage: pm2 start ecosystem.config.js
// See docs/DEPLOYMENT.md for full deploy guide.

module.exports = {
  apps: [{
    name:        'hostel-bot',
    script:      './index.js',
    instances:   1,           // single instance — WhatsApp session is unique
    exec_mode:   'fork',      // not cluster (whatsapp-web.js doesn't support multi-instance)
    autorestart: true,
    watch:       false,       // do not watch files in production
    max_memory_restart: '1G', // restart if memory exceeds 1GB (Chromium leaks)

    env: {
      NODE_ENV: 'production',
    },

    // Logs
    error_file:      './logs/err.log',
    out_file:        './logs/out.log',
    merge_logs:      true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',

    // Restart policy
    min_uptime:    '10s',  // process must be up 10s to be considered "started"
    max_restarts:  10,     // give up after 10 restarts in a row
    restart_delay: 4000,   // wait 4s between restart attempts
  }],
};
