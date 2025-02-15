import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import * as path from 'path';

const fixTypes = (content: string): string => {
  // Fix imports
  content = content.replace(
    /import\s*{\s*auth\s*}\s*from\s*['"]\.\.\/middleware\/auth\.js['"]/g,
    `import { requireAuth } from '../middleware/require-auth.js'`
  );

  // Fix db imports
  content = content.replace(
    /import\s*{\s*(?:getDb|connectToDatabase)\s*}\s*from\s*['"]\.\.?\/(?:db|db\/db)\.js['"]/g,
    `import { db } from '../db/database.service.js'`
  );

  // Fix validateRequest body/query type issues
  content = content.replace(/validateRequest\(\{\s*body:\s*([^}]+)\}\)/g, 'validateRequest($1)');
  content = content.replace(/validateRequest\(\{\s*query:\s*([^}]+)\}\)/g, 'validateRequest($1)');

  // Fix db variable declarations
  content = content.replace(
    /const\s+db\s*=\s*await\s+db\.getDb\(\)/g,
    'const database = db.getDb()'
  );

  // Fix role checks
  content = content.replace(
    /req\.user\?.role\s*!==\s*['"]admin['"]/g,
    '!req.user?.roles.includes("admin")'
  );

  return content;
};

async function main() {
  const files = await glob('src/**/*.ts');

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const fixed = fixTypes(content);

    if (content !== fixed) {
      console.log(`Fixing ${file}`);
      writeFileSync(file, fixed);
    }
  }
}

main().catch(console.error);
