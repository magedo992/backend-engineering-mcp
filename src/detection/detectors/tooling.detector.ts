import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ProjectProfile,
  DetectedValue,
  DetectionEvidence,
  DetectionOptions,
  OrmTool,
} from '../../types/project.types.js';
import { PackageJson, PackageReader } from '../readers/package-reader.js';
import { LockfileReader } from '../readers/lockfile-reader.js';

export class ToolingDetector {
  constructor(
    private readonly projectPath: string,
    private readonly packageReader: PackageReader,
    private readonly lockfileReader: LockfileReader,
  ) {}

  detect(profile: ProjectProfile, packageJson: PackageJson): void {
    this.detectTypescript(profile, packageJson);
    this.detectPrisma(profile, packageJson);
    this.detectTesting(profile, packageJson);
    this.detectLinter(profile, packageJson);
    this.detectPrettier(profile, packageJson);
    this.detectSwagger(profile, packageJson);
    this.detectDocker(profile);
    this.detectDockerCompose(profile);
    this.detectSonarQube(profile);
  }

  private detectTypescript(profile: ProjectProfile, packageJson: PackageJson): void {
    const deps = this.packageReader.getDependencies(packageJson);
    const declared = deps.typescript;
    const hasTsConfig = this.exists('tsconfig.json');
    if (!declared && !hasTsConfig) return;
    const evidence: DetectionEvidence[] = [];
    if (declared) {
      evidence.push(this.createDependencyEvidence('package.json', `typescript: ${declared}`));
    }
    if (hasTsConfig) {
      evidence.push(this.createConfigEvidence('tsconfig.json', 'tsconfig.json exists'));
    }
    const options: DetectionOptions<'TypeScript'> = {
      value: 'TypeScript',
      evidence,
      installedPackageName: 'typescript',
      ...(declared && { declaredVersion: this.cleanVersion(declared) }),
    };
    profile.typescript = this.createDetection(options);
  }

  private detectPrisma(profile: ProjectProfile, packageJson: PackageJson): void {
    const deps = this.packageReader.getDependencies(packageJson);
    const prismaDep = deps.prisma || deps['@prisma/client'];
    const hasSchema = this.exists('prisma/schema.prisma');
    if (!prismaDep && !hasSchema) return;

    const evidence: DetectionEvidence[] = [];
    if (deps.prisma) {
      evidence.push(this.createDependencyEvidence('package.json', `prisma: ${deps.prisma}`));
    } else if (deps['@prisma/client']) {
      evidence.push(this.createDependencyEvidence('package.json', `@prisma/client: ${deps['@prisma/client']}`));
    }
    if (hasSchema) {
      evidence.push(this.createConfigEvidence('prisma/schema.prisma', 'prisma/schema.prisma exists'));
    }
    const installedName = deps.prisma ? 'prisma' : '@prisma/client';
    const options: DetectionOptions<'Prisma'> = {
      value: 'Prisma',
      evidence,
      installedPackageName: installedName,
      ...(prismaDep && { declaredVersion: this.cleanVersion(prismaDep) }),
    };

    const prismaDetection = this.createDetection(options);
    profile.prismaTooling = prismaDetection;

    const ormDetection: DetectedValue<OrmTool> = {
      value: 'Prisma',
      confidence: 'HIGH',
      evidence: [...prismaDetection.evidence],
      ...(prismaDetection.declaredVersion && { declaredVersion: prismaDetection.declaredVersion }),
      ...(prismaDetection.installedVersion && { installedVersion: prismaDetection.installedVersion }),
    };
    profile.orm = ormDetection;
  }

  private detectTesting(profile: ProjectProfile, packageJson: PackageJson): void {
    const deps = this.packageReader.getDependencies(packageJson);
    if (deps.jest) {
      const declared = deps.jest;
      const cleanVer = this.cleanVersion(declared);
      const options: DetectionOptions<'Jest' | 'Vitest'> = {
        value: 'Jest',
        evidence: [this.createDependencyEvidence('package.json', `jest: ${cleanVer}`)],
        installedPackageName: 'jest',
        declaredVersion: cleanVer,
      };
      profile.testing = this.createDetection(options);
      return;
    }
    if (deps.vitest) {
      const declared = deps.vitest;
      const cleanVer = this.cleanVersion(declared);
      const options: DetectionOptions<'Jest' | 'Vitest'> = {
        value: 'Vitest',
        evidence: [this.createDependencyEvidence('package.json', `vitest: ${cleanVer}`)],
        installedPackageName: 'vitest',
        declaredVersion: cleanVer,
      };
      profile.testing = this.createDetection(options);
    }
  }

  private detectLinter(profile: ProjectProfile, packageJson: PackageJson): void {
    const deps = this.packageReader.getDependencies(packageJson);
    const hasEslintDep = Boolean(deps.eslint);
    const hasConfig = this.exists('eslint.config.js') || this.exists('eslint.config.mjs') || this.exists('.eslintrc.json') || this.exists('.eslintrc.js');
    if (!hasEslintDep && !hasConfig) return;
    const evidence: DetectionEvidence[] = [];
    if (deps.eslint) evidence.push(this.createDependencyEvidence('package.json', `eslint: ${deps.eslint}`));
    if (hasConfig) evidence.push(this.createConfigEvidence('eslint.config.*', 'ESLint config exists'));
    const options: DetectionOptions<'ESLint'> = {
      value: 'ESLint',
      evidence,
      installedPackageName: 'eslint',
      ...(deps.eslint && { declaredVersion: this.cleanVersion(deps.eslint) }),
    };
    profile.linter = this.createDetection(options);
  }

  private detectPrettier(profile: ProjectProfile, packageJson: PackageJson): void {
    const deps = this.packageReader.getDependencies(packageJson);
    const hasDep = Boolean(deps.prettier);
    const hasConfig = this.exists('.prettierrc') || this.exists('.prettierrc.json');
    if (!hasDep && !hasConfig) return;
    const evidence: DetectionEvidence[] = [];
    if (deps.prettier) evidence.push(this.createDependencyEvidence('package.json', `prettier: ${deps.prettier}`));
    if (hasConfig) evidence.push(this.createConfigEvidence('.prettierrc', 'Prettier config exists'));
    const options: DetectionOptions<'Prettier'> = {
      value: 'Prettier',
      evidence,
      installedPackageName: 'prettier',
      ...(deps.prettier && { declaredVersion: this.cleanVersion(deps.prettier) }),
    };
    profile.prettier = this.createDetection(options);
  }

  private detectSwagger(profile: ProjectProfile, packageJson: PackageJson): void {
    const deps = this.packageReader.getDependencies(packageJson);
    const swaggerDep = deps['swagger-ui-express'] || deps['@nestjs/swagger'] || deps['swagger-jsdoc'];
    const depName = deps['swagger-ui-express'] ? 'swagger-ui-express' : deps['@nestjs/swagger'] ? '@nestjs/swagger' : 'swagger-jsdoc';
    const hasFile = this.exists('swagger.json') || this.exists('openapi.json');
    if (!swaggerDep && !hasFile) return;
    const evidence: DetectionEvidence[] = [];
    if (swaggerDep) evidence.push(this.createDependencyEvidence('package.json', `${depName}: ${swaggerDep}`));
    if (hasFile) evidence.push(this.createConfigEvidence('openapi.*', 'OpenAPI file exists'));
    const options: DetectionOptions<boolean> = {
      value: true,
      evidence,
      ...(swaggerDep && { installedPackageName: depName, declaredVersion: this.cleanVersion(swaggerDep) }),
    };
    profile.swagger = this.createDetection(options);
  }

  private detectDocker(profile: ProjectProfile): void {
    if (this.exists('Dockerfile')) {
      profile.docker = { value: true, confidence: 'HIGH', evidence: [this.createConfigEvidence('Dockerfile', 'Dockerfile detected.')] };
    }
  }

  private detectDockerCompose(profile: ProjectProfile): void {
    if (this.exists('docker-compose.yml') || this.exists('docker-compose.yaml')) {
      profile.dockerCompose = { value: true, confidence: 'HIGH', evidence: [this.createConfigEvidence('docker-compose', 'Docker Compose detected.')] };
    }
  }

  private detectSonarQube(profile: ProjectProfile): void {
    if (this.exists('sonar-project.properties')) {
      profile.sonarQube = { value: true, confidence: 'HIGH', evidence: [this.createConfigEvidence('sonar-project.properties', 'SonarQube config detected.')] };
    }
  }

  private createDetection<T>(options: DetectionOptions<T>): DetectedValue<T> {
    const installedVersion = options.installedPackageName ? this.lockfileReader.getInstalledVersion(options.installedPackageName) : undefined;
    return {
      value: options.value,
      confidence: 'HIGH',
      evidence: options.evidence,
      ...(options.declaredVersion && { declaredVersion: options.declaredVersion }),
      ...(installedVersion && { installedVersion }),
    };
  }

  private createDependencyEvidence(source: string, detail: string): DetectionEvidence {
    return { source, kind: 'DEPENDENCY', detail, strength: 'STRONG' };
  }

  private createConfigEvidence(source: string, detail: string): DetectionEvidence {
    return { source, kind: 'CONFIG_FILE', detail, strength: 'STRONG' };
  }

  private exists(fileName: string): boolean {
    return fs.existsSync(path.join(this.projectPath, fileName));
  }

  private cleanVersion(version: string): string {
    return version.replace(/^[~^<>=\s]*/g, '').trim();
  }
}