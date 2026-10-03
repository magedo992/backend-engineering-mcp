import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DatabaseEngine } from '../types/project.types.js';

export interface SourceHit {
  file: string;
  engine: DatabaseEngine;
  snippet: string;
  line: number;
}

const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', '.next', 'build']);
const VALID_EXT = new Set(['.ts', '.js', '.mts', '.mjs']);

type Pattern = { engine: DatabaseEngine; regex: RegExp; detail: string };
const PATTERNS: Pattern[] = [
  { engine: 'PostgreSQL' as DatabaseEngine, regex: /new\s+PrismaClient\s*\(/, detail: 'new PrismaClient() instantiation' },
  { engine: 'PostgreSQL' as DatabaseEngine, regex: /from\s+['"]@prisma\/client['"]/, detail: 'import from @prisma/client' },
  { engine: 'PostgreSQL' as DatabaseEngine, regex: /from\s+['"]pg['"]|require\(['"]pg['"]\)|new\s+Pool\s*\(/, detail: 'pg Pool usage' },
  { engine: 'MySQL' as DatabaseEngine, regex: /from\s+['"]mysql2?['"]|createConnection\s*\(|createPool\s*\(.*mysql/i, detail: 'mysql/mysql2 usage' },
  { engine: 'MongoDB' as DatabaseEngine, regex: /from\s+['"]mongoose['"]|mongoose\.connect|new\s+MongoClient/, detail: 'mongoose/mongodb usage' },
  { engine: 'Redis' as DatabaseEngine, regex: /from\s+['"]ioredis['"]|from\s+['"]redis['"]|createClient\s*\(.*redis|new\s+Redis\s*\(/, detail: 'redis/ioredis usage' },
  { engine: 'MSSQL' as DatabaseEngine, regex: /from\s+['"]mssql['"]|from\s+['"]tedious['"]/, detail: 'mssql usage' },
  { engine: 'Unknown' as DatabaseEngine, regex: /process\.env\.(DATABASE_URL|POSTGRES_URL)/, detail: 'process.env.DATABASE_URL usage' },
    { engine: 'MySQL' as DatabaseEngine, regex: /synchronize\s*:\s*true/i, detail: 'TypeORM synchronize: true' },
  { engine: 'MySQL' as DatabaseEngine, regex: /dropSchema\s*:\s*true/i, detail: 'TypeORM dropSchema: true' },
];

export class DbSourceScanner {
  scan(projectRoot: string): SourceHit[] {
    const hits: SourceHit[] = [];
    this.walk(projectRoot, projectRoot, hits);
    return hits;
  }

  private sanitize(line: string): string {
    return line
      .replace(/(postgres|postgresql|mysql|mongodb(\+srv)?|redis):\/\/\S+/gi, '$1://***:***@***')
      .replace(/DATABASE_URL\s*=\s*\S+/gi, 'DATABASE_URL=***')
      .slice(0, 120);
  }

  private walk(projectRoot: string, currentDir: string, hits: SourceHit[]): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        this.walk(projectRoot, path.join(currentDir, entry.name), hits);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (!VALID_EXT.has(ext)) continue;
        this.scanFile(projectRoot, path.join(currentDir, entry.name), hits);
      }
    }
  }

  private scanFile(projectRoot: string, fullPath: string, hits: SourceHit[]): void {
    let content: string;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      return;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      for (const p of PATTERNS) {
        if (p.regex.test(line)) {
          hits.push({
            file: path.relative(projectRoot, fullPath).replace(/\\/g, '/'),
            engine: p.engine,
            snippet: `${p.detail} -> ${this.sanitize(line.trim())}`,
            line: i + 1,
          });
        }
      }
      const lower = line.toLowerCase();
      if (lower.includes('postgresql://') || lower.includes('postgres://')) {
        hits.push({
          file: path.relative(projectRoot, fullPath).replace(/\\/g, '/'),
          engine: 'PostgreSQL' as DatabaseEngine,
          snippet: this.sanitize(line.trim()),
          line: i + 1,
        });
      } else if (lower.includes('mongodb://') || lower.includes('mongodb+srv://')) {
        hits.push({
          file: path.relative(projectRoot, fullPath).replace(/\\/g, '/'),
          engine: 'MongoDB' as DatabaseEngine,
          snippet: this.sanitize(line.trim()),
          line: i + 1,
        });
      }
    }
  }
}