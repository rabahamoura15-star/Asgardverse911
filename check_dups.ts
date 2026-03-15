import fs from 'fs';

const file = 'src/translations.ts';
const content = fs.readFileSync(file, 'utf-8');

// Match language blocks
const langRegex = /^\s+([a-z]{2}|zh): \{([\s\S]*?)(^\s+\},|\n\s+zh:)/gm;
let match;
while ((match = langRegex.exec(content)) !== null) {
  const lang = match[1];
  const block = match[2];
  
  const keys = new Set();
  const duplicates = [];
  
  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('//')) continue;
    
    // Match key: "value" or key: {
    const keyMatch = line.match(/^([a-zA-Z0-9_]+)\s*:/);
    if (keyMatch) {
      const key = keyMatch[1];
      if (keys.has(key)) {
        duplicates.push({ key, line: i + 1 });
      } else {
        keys.add(key);
      }
    }
  }
  
  if (duplicates.length > 0) {
    console.log(`Language ${lang} has duplicates:`);
    console.log(duplicates.map(d => `${d.key} (line ${d.line})`).join(', '));
  }
}
