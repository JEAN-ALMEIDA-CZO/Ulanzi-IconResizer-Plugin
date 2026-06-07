const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/Loja/AppData/Roaming/Ulanzi/UlanziDeck/Plugins/com.ulanzi.iconresizer.ulanziPlugin/property-inspector';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

for (const file of files) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Remove { cache: 'no-store' }
    content = content.replace(/,\s*\{\s*cache:\s*'no-store'\s*\}/g, "");
    
    fs.writeFileSync(fullPath, content, 'utf8');
}
console.log('Removed cache: no-store from all files.');
