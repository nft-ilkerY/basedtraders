module.exports = {
  apps: [{
    name: 'based-traders',
    script: 'node_modules/tsx/dist/cli.mjs',
    args: 'server/unified.ts',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
  }]
}
