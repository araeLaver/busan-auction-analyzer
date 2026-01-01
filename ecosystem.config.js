module.exports = {
  apps : [{
    name: "busan-auction-analyzer-app",
    script: "src/app-optimized.js",
    watch: false,
    ignore_watch: ["node_modules", "logs"],
    instances: "max",
    exec_mode: "cluster",
    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
      // 여기에 프로덕션 환경에 필요한 다른 환경 변수 추가
      // 예: PG_HOST, PG_DATABASE, PG_USER, PG_PASSWORD, ONBID_API_KEY 등
      // 실제 배포 시에는 시스템 환경 변수 또는 .env 파일을 pm2-dotenv 등을 통해 관리하는 것이 더 안전
    },
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "logs/app-error.log",
    out_file: "logs/app-out.log",
    combine_logs: true
  }]
};