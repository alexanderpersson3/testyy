import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

function fixImportPaths(content: string): string {
  // Fix ..js/ to ../ paths
  content = content.replace(/from ['"]\.\.js\//g, 'from \'../');
  
  // Fix double extensions
  content = content.replace(/\.js\.js(['"])/g, '.js$1');
  
  // Fix incorrect relative paths
  content = content.replace(/from ['"]\.\.\/\.\.\/\.\.\//g, 'from \'../');
  
  // Ensure .js extension for all relative imports
  content = content.replace(/from ['"](\.[^'"]*?)(?!\.js)['"](\s*;?\s*$)/gm, 'from \'$1.js\'$2');
  
  return content;
}

async function processFiles() {
  try {
    const files = await glob('src/**/*.{ts,tsx}');
    let fixCount = 0;
    
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const fixedContent = fixImportPaths(content);
      
      if (content !== fixedContent) {
        console.log(`Fixing imports in ${file}`);
        writeFileSync(file, fixedContent, 'utf8');
        fixCount++;
      }
    }
    
    console.log(`Fixed imports in ${fixCount} files`);
  } catch (error) {
    console.error('Error fixing import paths:', error);
    process.exit(1);
  }
}

processFiles(); 