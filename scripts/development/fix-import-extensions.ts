import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const fixImportExtensions = (content: string): string => {
  // Fix double .js extensions
  content = content.replace(/\.js\.js/g, '.js');
  
  // Fix incorrect relative imports
  content = content.replace(/(from\s+['"])(\.\.js\.)/g, '$1../');
  
  // Fix double semicolons after imports
  content = content.replace(/;;\s*$/gm, ';');
  
  return content;
};

const processFiles = async (): Promise<void> => {
  try {
    const files = await glob('src/**/*.{ts,tsx}');
    
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const fixedContent = fixImportExtensions(content);
      
      if (content !== fixedContent) {
        console.log(`Fixing imports in ${file}`);
        writeFileSync(file, fixedContent, 'utf8');
      }
    }
    
    console.log('Import paths fixed successfully');
  } catch (error) {
    console.error('Error fixing import paths:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

processFiles(); 