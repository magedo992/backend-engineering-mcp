import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ProjectProfile,
  ProjectStructure,
  DetectionEvidence,
} from '../../types/project.types.js';
import { PackageReader, PackageJson } from '../readers/package-reader.js';

export class StructureDetector {
  constructor(
    private readonly projectPath: string,
    private readonly packageReader: PackageReader,
  ) {}

  detect(profile: ProjectProfile, packageJson: PackageJson): void {
    this.detectEntryPoint(profile, packageJson);
    this.detectStructure(profile);
  }

  private detectEntryPoint(profile: ProjectProfile, packageJson: PackageJson): void {
    const entryFromPkg = this.packageReader.getEntryPoint(packageJson);
    const sourceEntry = this.findSourceEntry();

    if (!entryFromPkg && !sourceEntry) return;

    const evidence: DetectionEvidence[] = [];

    if (entryFromPkg) {
      evidence.push(
        this.createEvidence(
          'package.json',
          'CONFIG_FILE',
          `main/module: ${entryFromPkg}`,
          'STRONG',
        ),
      );
    }

    if (sourceEntry) {
      evidence.push(
        this.createEvidence(
          sourceEntry,
          'SOURCE_CODE',
          `${sourceEntry} exists`,
          'STRONG',
        ),
      );
    }

    profile.entryPoint = {
      ...(sourceEntry && { source: sourceEntry }),
      ...(entryFromPkg && { build: entryFromPkg }),
      evidence,
    };
  }

  private detectStructure(profile: ProjectProfile): void {
    const check = (relPath: string): boolean =>
      fs.existsSync(path.join(this.projectPath, relPath));

    const checkAny = (relPaths: string[]): boolean =>
      relPaths.some((relPath) => check(relPath));

    const structure: ProjectStructure = {
      src: check('src'),
      controllers: check('src/controllers'),
      services: check('src/services'),
      routes: check('src/routes'),
      middlewares: checkAny(['src/middlewares', 'src/middleware']),
      prisma: check('prisma'),
      hasEnv: check('.env'),
      utils: checkAny(['src/utils', 'src/helpers']),
      tests: checkAny(['tests', '__tests__', 'src/__tests__']),
      hasDockerfile: check('Dockerfile'),
      hasEnvExample: check('.env.example'),
      hasCI: checkAny(['.github/workflows', '.gitlab-ci.yml', '.circleci']),
    };

    profile.structure = structure;
  }

  private findSourceEntry(): string | undefined {
    const candidates = [
      'src/server.ts',
      'src/app.ts',
      'src/index.ts',
      'src/main.ts',
      'index.ts',
    ];

    return candidates.find((candidate) =>
      fs.existsSync(path.join(this.projectPath, candidate)),
    );
  }

  private createEvidence(
    source: string,
    kind: DetectionEvidence['kind'],
    detail: string,
    strength: DetectionEvidence['strength'] = 'STRONG',
  ): DetectionEvidence {
    return {
      source,
      kind,
      detail,
      strength,
    };
  }
}