import fs from 'fs';

const file = 'src/translations.ts';
const content = fs.readFileSync(file, 'utf-8');
const lines = content.split('\n');

// Remove lines 796 to 1046 (0-indexed: 795 to 1045)
lines.splice(795, 251);

fs.writeFileSync(file, lines.join('\n'));
console.log('Done');
