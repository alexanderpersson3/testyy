import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

function fixTypeScriptIssues(content: string): string {
  // Fix double .js extensions in imports
  content = content.replace(/\.js\.js(['"])/g, '.js$1');
  
  // Fix incorrect relative paths
  content = content.replace(/from ['"]\.\.\/\.\.\/\.\.\//g, 'from \'../');
  
  // Add type annotations to parameters
  content = content.replace(/\(([\w\s,]+)\)\s*=>/g, (match: string, params: string) => {
    const typedParams = params.split(',').map((param: string) => {
      param = param.trim();
      if (!param.includes(':')) {
        return `${param}: any`;
      }
      return param;
    }).join(', ');
    return `(${typedParams}) =>`;
  });
  
  // Add 'override' modifier to message property in Error classes
  content = content.replace(
    /class\s+(\w+Error)\s+extends\s+Error\s*{[\s\n]*public\s+message\s*:/g,
    'class $1 extends Error {\n  public override message:'
  );
  
  // Fix ObjectId imports
  content = content.replace(
    /import\s+type\s*{\s*ObjectId\s*}/g,
    'import { ObjectId }'
  );
  
  // Add missing type imports
  if (content.includes('Recipe') && !content.includes('import type { Recipe }')) {
    content = 'import type { Recipe } from \'../types/recipe.js\';\n' + content;
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