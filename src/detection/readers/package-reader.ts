import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PackageJson {
  name?: string;
  version?: string;
  main?: string;
  type?: 'commonjs' | 'module';
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: {
    node?: string;
    npm?: string;
  };
  packageManager?: string;
  scripts?: Record<string, string>;
}

export class PackageReader {
  private readonly packagePath: string;

  constructor(private readonly projectPath: string) {
    this.packagePath = path.join(projectPath, 'package.json');
  }

  read(): PackageJson {
    if (!fs.existsSync(this.packagePath)) {
      throw new Error('package.json was not found.');
    }
    try {
      return JSON.parse(fs.readFileSync(this.packagePath, 'utf-8')) as PackageJson;
    } catch {
      throw new Error('package.json exists but could not be parsed.');
    }
  }

  getDependencies(packageJson: PackageJson): Record<string, string> {
    return { ...packageJson.dependencies, ...packageJson.devDependencies };
  }

  getDependencyVersion(packageJson: PackageJson, dependency: string): string | undefined {
    return this.getDependencies(packageJson)[dependency];
  }

  getScripts(packageJson: PackageJson): Record<string, string> {
    return packageJson.scripts ?? {};
  }

  getEntryPoint(packageJson: PackageJson): string | undefined {
    return packageJson.main;
  }

  getNodeEngine(packageJson: PackageJson): string | undefined {
    return packageJson.engines?.node;
  }

  getPackageManagerSpec(packageJson: PackageJson): string | undefined {
    return packageJson.packageManager;
  }

  isESM(packageJson: PackageJson): boolean {
    return packageJson.type === 'module';
  }
}