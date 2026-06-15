const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const webLogo = path.join(root, 'icons', 'fizyopark-logo-web.png');
const fullLogo = path.join(root, 'icons', 'fizyopark-logo.png');
const stylesPath = path.join(root, 'styles.css');
const logoPath = fs.existsSync(webLogo) ? webLogo : fullLogo;

const buf = fs.readFileSync(logoPath);

const embedBlock = `/* BRAND_LOGO_EMBED_START – scripts/embed-brand-logo.js ile üretilir */
:root {
  --brand-logo: url("./icons/fizyopark-logo-web.png");
}
.login-logo {
  background: var(--brand-logo) center / contain no-repeat;
}
/* BRAND_LOGO_EMBED_END */`;

const styles = fs.readFileSync(stylesPath, 'utf8');
const start = '/* BRAND_LOGO_EMBED_START';
const end = '/* BRAND_LOGO_EMBED_END */';

if (!styles.includes(start)) {
  console.error('styles.css içinde BRAND_LOGO_EMBED marker bulunamadı.');
  process.exit(1);
}

const re = /\/\* BRAND_LOGO_EMBED_START[\s\S]*?\/\* BRAND_LOGO_EMBED_END \*\//;
const next = styles.replace(re, embedBlock);
fs.writeFileSync(stylesPath, next);

console.log('Kaynak PNG:', logoPath, buf.length, 'byte');
console.log('Logo CSS url("./icons/fizyopark-logo-web.png") olarak ayarlandı (base64 gömme kaldırıldı).');
