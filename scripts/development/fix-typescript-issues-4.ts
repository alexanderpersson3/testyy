import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

function fixTypeScriptIssues(content: string): string {
  // Fix imports from mongodb
  content = content.replace(/import\s+type\s*{\s*ObjectId\s*}\s*from\s*['"]mongodb['"]/g, 'import { ObjectId } from \'mongodb\'');
  
  // Fix imports from express
  content = content.replace(/import\s+type\s*{\s*([^}]+)\s*}\s*from\s*['"]express['"]/g, (match, types) => {
    const typeList = types.split(',').map((t: string) => t.trim());
    const valueTypes = ['Router'];
    const importedTypes = typeList.filter((t: string) => !valueTypes.includes(t));
    const importedValues = typeList.filter((t: string) => valueTypes.includes(t));
    
    let result = '';
    if (importedTypes.length) {
      result += `import type { ${importedTypes.join(', ')} } from 'express';\n`;
    }
    if (importedValues.length) {
      result += `import { ${importedValues.join(', ')} } from 'express';`;
    }
    return result;
  });

  // Fix logger imports
  content = content.replace(/import\s+logger\s+from\s+['"]\.\.\/logger\.js['"]/g, 'import logger from \'../utils/logger.js\'');

  // Fix duplicate Collection imports
  content = content.replace(/import\s+type\s*{\s*Collection\s*}\s*from\s*['"]mongodb['"]/g, '');
  content = content.replace(/import\s+type\s*{\s*Collection\s*}\s*from\s*['"]\.\.\/types\/express\.js['"]/g, 'import type { Collection } from \'mongodb\'');

  // Fix type-only imports
  content = content.replace(/import\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"]+)['"]/g, (match, imports, path) => {
    const typeList = imports.split(',').map((t: string) => t.trim());
    const typeOnlyImports = typeList.filter((t: string) => t.includes('type'));
    const valueImports = typeList.filter((t: string) => !t.includes('type'));
    
    let result = '';
    if (typeOnlyImports.length) {
      result += `import type { ${typeOnlyImports.map(t => t.replace('type ', '')).join(', ')} } from '${path}';\n`;
    }
    if (valueImports.length) {
      result += `import { ${valueImports.join(', ')} } from '${path}';`;
    }
    return result;
  });

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

  // Fix missing override modifiers
  content = content.replace(
    /class\s+(\w+Error)\s+extends\s+Error\s*{[\s\n]*public\s+message\s*:/g,
    'class $1 extends Error {\n  public override message:'
  );

  // Fix missing createdAt/updatedAt fields
  content = content.replace(
    /interface\s+(\w+)\s+extends\s+BaseDocument\s*{[^}]*}/g,
    (match) => {
      if (!match.includes('createdAt') || !match.includes('updatedAt')) {
        return match.replace(
          /}$/,
          '  createdAt: Date;\n  updatedAt: Date;\n}'
        );
      }
      return match;
    }
  );

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