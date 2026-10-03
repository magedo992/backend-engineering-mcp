import * as fs from 'node:fs';
import * as path from 'node:path';
import { DetectedValue, DetectionEvidence, ProjectProfile } from '../../types/project.types.js';
import { PackageJson, PackageReader } from '../readers/package-reader.js';
import { LockfileReader } from '../readers/lockfile-reader.js';

type PackageManagerType = 'npm' | 'yarn' | 'pnpm';

export class EcosystemDetector {
  constructor(
    private readonly projectPath: string,
    private readonly packageReader: PackageReader,
    private readonly lockfileReader: LockfileReader,
  ) {}

  detect(profile: ProjectProfile, packageJson: PackageJson): void {
    this.detectEcosystem(profile);
    this.detectLanguage(profile, packageJson);
    this.detectPackageManager(profile, packageJson);
  }

  private detectEcosystem(profile: ProjectProfile): void {
    if (this.exists('package.json')) {
      profile.ecosystem = {
        value: 'Node.js',
        confidence: 'HIGH',
        evidence: [
          this.createConfigEvidence('package.json', 'package.json found - Node.js ecosystem'),
        ],
      };
    }
  }

  private detectLanguage(profile: ProjectProfile, packageJson: PackageJson): void {
    const deps = this.packageReader.getDependencies(packageJson);
    const declaredVersion = deps.typescript;
    const hasTsConfig = this.exists('tsconfig.json');

    if (declaredVersion || hasTsConfig) {
      const evidence: DetectionEvidence[] = [];

      if (declaredVersion) {
        evidence.push(this.createDependencyEvidence('typescript', declaredVersion));
      }
      if (hasTsConfig) {
        evidence.push(this.createConfigEvidence('tsconfig.json', 'tsconfig.json exists'));
      }

      const installed = this.lockfileReader.getInstalledVersion('typescript');

      profile.language = {
        value: 'TypeScript',
        confidence: 'HIGH',
        evidence,
        ...(declaredVersion && { declaredVersion: this.cleanVersion(declaredVersion) }),
        ...(installed && { installedVersion: installed }),
      };
      return;
    }

    profile.language = {
      value: 'JavaScript',
      confidence: 'MEDIUM',
      evidence: [
        this.createConfigEvidence(
          'package.json',
          'package.json without TypeScript evidence',
          'SUPPORTING',
        ),
      ],
    };
  }

  private detectPackageManager(profile: ProjectProfile, packageJson: PackageJson): void {
    const lockfileMap: Array<{ file: string; manager: PackageManagerType }> = [
      { file: 'pnpm-lock.yaml', manager: 'pnpm' },
      { file: 'yarn.lock', manager: 'yarn' },
      { file: 'package-lock.json', manager: 'npm' },
      { file: 'bun.lockb', manager: 'pnpm' },
    ];

    for (const { file, manager } of lockfileMap) {
      if (this.exists(file)) {
        profile.packageManager = this.createPmDetection(manager, file, packageJson);
        return;
      }
    }

    if (packageJson.packageManager) {
      const [manager, version] = packageJson.packageManager.split('@');
      if (manager && this.isValidPackageManager(manager)) {
        profile.packageManager = {
          value: manager,
          confidence: 'MEDIUM',
          evidence: [
            this.createConfigEvidence(
              'package.json',
              `packageManager: ${packageJson.packageManager}`,
              'SUPPORTING',
            ),
          ],
          ...(version && { declaredVersion: version }),
        };
      }
    }
  }

  private createPmDetection(
    value: PackageManagerType,
    lockfile: string,
    pkg: PackageJson,
  ): DetectedValue<PackageManagerType> {
    const evidence: DetectionEvidence[] = [
      this.createLockfileEvidence(lockfile, `${lockfile} detected`),
    ];

    const pmParts = pkg.packageManager?.split('@');
    const declaredVersion = pmParts && pmParts[0] === value ? pmParts[1] : undefined;

    if (declaredVersion && pkg.packageManager) {
      evidence.push(
        this.createConfigEvidence(
          'package.json',
          `packageManager: ${pkg.packageManager}`,
          'SUPPORTING',
        ),
      );
    }

    const installed = this.lockfileReader.getPackageManagerVersion?.();

    return {
      value,
      confidence: 'HIGH',
      evidence,
      ...(declaredVersion && { declaredVersion }),
      ...(installed && { installedVersion: installed }),
    };
  }

  private createDependencyEvidence(packageName: string, version: string): DetectionEvidence {
    return {
      source: 'package.json',
      kind: 'DEPENDENCY',
      detail: `${packageName}: ${version}`,
      strength: 'STRONG',
    };
  }

  private createConfigEvidence(
    source: string,
    detail: string,
    strength: DetectionEvidence['strength'] = 'STRONG',
  ): DetectionEvidence {
    return {
      source,
      kind: 'CONFIG_FILE',
      detail,
      strength,
    };
  }

  private createLockfileEvidence(
    source: string,
    detail: string,
    strength: DetectionEvidence['strength'] = 'STRONG',
  ): DetectionEvidence {
    return {
      source,
      kind: 'LOCKFILE',
      detail,
      strength,
    };
  }

  private isValidPackageManager(manager: string): manager is PackageManagerType {
    return manager === 'npm' || manager === 'yarn' || manager === 'pnpm';
  }

  private exists(fileName: string): boolean {
    return fs.existsSync(path.join(this.projectPath, fileName));
  }

  private cleanVersion(version: string): string {
    return version.replace(/^[~^<>=\s]*/g, '').trim();
  }
}