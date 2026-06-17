const { execSync } = require('child_process');

try {
  const out = execSync('netstat -ano').toString();
  const lines = out.split('\n').filter(l => l.includes(':3000') && l.includes('LISTENING'));
  lines.forEach(l => {
    const pid = l.trim().split(/\s+/).pop();
    if (pid && pid !== '0') {
      try {
        execSync(`taskkill /F /PID ${pid}`);
        console.log(`[predev] Port 3000 temizlendi — eski PID ${pid} sonlandırıldı`);
      } catch (_) {}
    }
  });
} catch (_) {}
