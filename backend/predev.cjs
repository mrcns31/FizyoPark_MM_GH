const { execSync } = require('child_process');

try {
  const out = execSync('lsof -ti:3000').toString().trim();
  if (out) {
    out.split('\n').forEach(pid => {
      try {
        execSync(`kill -9 ${pid}`);
        console.log(`[predev] Port 3000 temizlendi — eski PID ${pid} sonlandırıldı`);
      } catch (_) {}
    });
  }
} catch (_) {}
