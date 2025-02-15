import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

function fixTypeScriptIssues(content: string): string {
  // Fix duplicate type imports
  const importedTypes = new Set<string>();
  content = content.replace(/import\s+type\s*{\s*([^}]+)\s*}\s*from\s*['"][^'"]+['"]/g, (match, types) => {
    const typeList = types.split(',').map((t: string) => t.trim());
    const uniqueTypes = typeList.filter((t: string) => {
      if (importedTypes.has(t)) return false;
      importedTypes.add(t);
      return true;
    });
    return uniqueTypes.length ? `import type { ${uniqueTypes.join(', ')} } from '../types/index.js'` : '';
  });

  // Fix incorrect import paths
  content = content.replace(/from\s+['"]\.\.\/[^'"]+['"]/g, (match) => {
    return match.replace(/\.js\.js/, '.js').replace(/\.\.\/\.\.\/\.\.\//, '../');
  });

  // Add missing type declarations
  content = content.replace(/import\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"]+)['"]/g, (match, imports, path) => {
    if (imports.includes('ObjectId')) {
      return `import { ObjectId } from 'mongodb';`;
    }
    if (path.includes('express')) {
      return `import type { ${imports} } from '${path}';`;
    }
    return match;
  });

  // Fix implicit any types
  content = content.replace(/\(([\w\s,]+)\)\s*=>/g, (match, params) => {
    const typedParams = params.split(',').map((param: string) => {
      param = param.trim();
      if (!param.includes(':')) {
        return `${param}: unknown`;
      }
      return param;
    }).join(', ');
    return `(${typedParams}) =>`;
  });

  // Add missing fs import
  if (content.includes('fs.')) {
    content = "import * as fs from 'fs';\n" + content;
  }

  // Add missing Collection type
  if (content.includes('Collection<')) {
    content = "import type { Collection } from 'mongodb';\n" + content;
  }

  return content;
}

async function processFiles() {
  try {
    const files = await glob('src/**/*.{ts,tsx}');
    let fixCount = 0;
    
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const fixedContent = fixTypeScriptIssues(content);
      
      if (content !== fixedContent) {
        console.log(`Fixing TypeScript issues in ${file}`);
        writeFileSync(file, fixedContent, 'utf8');
        fixCount++;
      }
    }
    
    console.log(`Fixed TypeScript issues in ${fixCount} files`);
  } catch (error) {
    console.error('Error fixing TypeScript issues:', error);
    process.exit(1);
  }
}

processFiles(); 