import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import * as path from 'path';

const fixDbImports = (content: string): string => {
  // Replace direct db imports with DatabaseService
  content = content.replace(
    /import\s*{\s*(?:getDb|connectToDatabase)\s*}\s*from\s*['"]\.\.?\/db\/(?:connection|db)['"];?/g,
    `import { db } from '../db/database.service';`
  );

  // Replace direct db.collection calls with proper type-safe calls
  content = content.replace(/db\.collection\(['"](\w+)['"]\)/g, 'db.getCollection("$1")');

  // Replace any remaining getDb() calls
  content = content.replace(/getDb\(\)/g, 'db.getDb()');

  return content;
};

async function main() {
  const files = await glob('src/**/*.ts');

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const fixed = fixDbImports(content);

    if (content !== fixed) {
      console.log(`Fixing ${file}`);
      writeFileSync(file, fixed);
    }
  }
}

main().catch(console.error);
