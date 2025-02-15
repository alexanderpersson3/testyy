import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

function fixTypeScriptIssues(content: string): string {
  // Fix imports from express
  content = content.replace(/import\s+type\s*{\s*([^}]+)\s*}\s*from\s*['"]express['"]/g, (match, types) => {
    return `import type { ${types} } from 'express-serve-static-core';`;
  });

  // Fix imports from mongodb
  content = content.replace(/import\s+type\s*{\s*([^}]+)\s*}\s*from\s*['"]mongodb['"]/g, (match, types) => {
    const typeList = types.split(',').map((t: string) => t.trim());
    const valueTypes = ['ObjectId'];
    const importedTypes = typeList.filter((t: string) => !valueTypes.includes(t));
    const importedValues = typeList.filter((t: string) => valueTypes.includes(t));
    
    let result = '';
    if (importedTypes.length) {
      result += `import type { ${importedTypes.join(', ')} } from 'mongodb';\n`;
    }
    if (importedValues.length) {
      result += `import { ${importedValues.join(', ')} } from 'mongodb';`;
    }
    return result;
  });

  // Fix imports from types/index.js
  content = content.replace(/from\s+['"]\.\.\/types\/index\.js['"]/g, match => {
    return match.replace('index.js', 'express.js');
  });

  // Fix fs imports
  if (content.includes('fs.')) {
    content = content.replace(/import\s+\*\s+as\s+fs\s+from\s+['"]fs['"];?\s*/g, '');
    content = content.replace(/import\s+fs\s+from\s+['"]fs['"];?\s*/g, '');
    content = "import { promises as fs } from 'fs';\n" + content;
  }

  // Fix PDFDocument imports
  if (content.includes('PDFDocument')) {
    content = content.replace(/import\s+type\s*{\s*PDFDocument\s*}\s*from\s*['"][^'"]+['"]/g, '');
    content = "import { PDFDocument } from 'pdf-lib';\n" + content;
  }

  // Fix Router imports
  if (content.includes('Router()')) {
    content = content.replace(/import\s+type\s*{\s*Router[^}]*}\s*from\s*['"]express['"][;\s]*/g, '');
    content = "import { Router } from 'express';\n" + content;
  }

  // Fix unused imports
  content = content.replace(/import\s+[^;]+;\s*(?=\s*(?:import|\/\/|\/\*|$))/g, (match) => {
    if (match.includes('type') && !content.includes(match.split('{')[1].split('}')[0].trim())) {
      return '';
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