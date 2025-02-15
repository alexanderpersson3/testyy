const fs = require('fs');
const glob = require('glob');
const path = require('path');

const addJsExtensions = (content: string): string => {
  // Add .js to relative imports that don't have an extension
  return content.replace(
    /(from\s+['"])(\.[^'"]*?)(?!\.(?:js|jsx|ts|tsx|json|css|scss)['"])/g,
    '$1$2.js'
  );
};

const fixImports = async () => {
  const files = await glob.glob('src/**/*.{ts,tsx}', { ignore: ['**/node_modules/**', '**/dist/**'] });
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const updatedContent = addJsExtensions(content);
    
    if (content !== updatedContent) {
      console.log(`Fixing imports in ${file}`);
      fs.writeFileSync(file, updatedContent);
    }
  }
};

fixImports().catch(console.error); 