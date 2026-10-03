import * as fs from 'node:fs';
import * as path from 'node:path';

type NpmLockFile = {
  lockfileVersion?: number;
  version?: string;
  packages?: Record<string, { version?: string }>;
  dependencies?: Record<string, { version?: string }>;
}

export class LockfileReader {
  private readonly npmLockPath: string;
  private readonly pnpmLockPath: string;
  private readonly yarnLockPath: string;
  private cache: NpmLockFile | null = null;
  private cacheExists: boolean | null = null;

  constructor(private readonly projectPath: string) {
    this.npmLockPath = path.join(projectPath, 'package-lock.json');
    this.pnpmLockPath = path.join(projectPath, 'pnpm-lock.yaml');
    this.yarnLockPath = path.join(projectPath, 'yarn.lock');
  }

  exists(): boolean {
    return fs.existsSync(this.npmLockPath);
  }

  hasAnyLockfile(): boolean {
    return fs.existsSync(this.npmLockPath) || 
           fs.existsSync(this.pnpmLockPath) || 
           fs.existsSync(this.yarnLockPath);
  }

  getLockfileType(): 'npm' | 'pnpm' | 'yarn' | null {
    if (fs.existsSync(this.npmLockPath)) return 'npm';
    if (fs.existsSync(this.pnpmLockPath)) return 'pnpm';
    if (fs.existsSync(this.yarnLockPath)) return 'yarn';
    return null;
  }

  private read(): NpmLockFile | null {
    if (this.cache !== null) return this.cache;
    if (this.cacheExists === false) return null;
    
    if (!fs.existsSync(this.npmLockPath)) {
      this.cacheExists = false;
      return null;
    }
    try {
      const raw = fs.readFileSync(this.npmLockPath, 'utf-8');
      this.cache = JSON.parse(raw) as NpmLockFile;
      this.cacheExists = true;
      return this.cache;
    } catch {
      this.cacheExists = false;
      return null;
    }
  }

  getInstalledVersion(packageName: string): string | undefined {
    const lock = this.read();
    
    if (lock) {
      const fromPackages = lock.packages?.[`node_modules/${packageName}`]?.version;
      if (fromPackages) return fromPackages;
      
      const fromDeps = lock.dependencies?.[packageName]?.version;
      if (fromDeps) return fromDeps;
    }
    
    return undefined;
  }

  getPackageManagerVersion(): string | undefined {
    const lock = this.read();
    if (!lock) return undefined;
    
    return lock.packages?.['']?.version ?? lock.version;
  }
}