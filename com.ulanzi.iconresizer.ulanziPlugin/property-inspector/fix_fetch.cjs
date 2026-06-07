const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/Loja/AppData/Roaming/Ulanzi/UlanziDeck/Plugins/com.ulanzi.iconresizer.ulanziPlugin/property-inspector';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

for (const file of files) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Fix broken syntax from powershell
    content = content.replace(/fetch\(\.\.\/\.json,\s*\{\s*cache:\s*'no-store'\s*\}\)/g, "fetch(`../${currentLangCode}.json`, { cache: 'no-store' })");
    content = content.replace(/fetch\(\.\.\/en\.json,\s*\{\s*cache:\s*'no-store'\s*\}\)/g, "fetch(`../en.json`, { cache: 'no-store' })");
    
    fs.writeFileSync(fullPath, content, 'utf8');
}
console.log('Fixed all syntax errors.');
