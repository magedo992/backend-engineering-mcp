import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProjectProfile } from '../types/project.types.js';
import { PackageReader } from './readers/package-reader.js';
import { LockfileReader } from './readers/lockfile-reader.js';
import { EcosystemDetector } from './detectors/ecosystem.detector.js';
import { FrameworkDetector } from './detectors/framework.detector.js';
import { ToolingDetector } from './detectors/tooling.detector.js';
import { RuntimeDetector } from './detectors/runtime.detector.js';
import { ScriptsDetector } from './detectors/scripts.detector.js';
import { StructureDetector } from './detectors/structure.detector.js';
import { DatabaseDetectionService } from './orchestrator/database/DatabaseDetectionService.js';
import { PrismaDetector } from './orchestrator/database/prisma.detector.js';
import { DockerDetector } from './orchestrator/database/docker.detector.js';
import { EnvDetector } from './orchestrator/database/env.detector.js';
import { DriversDetector } from './orchestrator/database/drivers.detector.js';

export class ProjectDetector {
  private readonly projectPath: string;
  private readonly packageReader: PackageReader;
  private readonly lockfileReader: LockfileReader;
  private readonly ecosystemDetector: EcosystemDetector;
  private readonly frameworkDetector: FrameworkDetector;
  private readonly toolingDetector: ToolingDetector;
  private readonly runtimeDetector: RuntimeDetector;
  private readonly scriptsDetector: ScriptsDetector;
  private readonly structureDetector: StructureDetector;
  private readonly databaseService: DatabaseDetectionService;

  constructor(projectPath: string) {
    this.projectPath = path.resolve(projectPath);
    
    if (!fs.existsSync(this.projectPath)) {
      throw new Error(`Project path does not exist: ${this.projectPath}`);
    }
    
    this.packageReader = new PackageReader(this.projectPath);
    this.lockfileReader = new LockfileReader(this.projectPath);
this.ecosystemDetector = new EcosystemDetector(this.projectPath, this.packageReader, this.lockfileReader);    this.frameworkDetector = new FrameworkDetector(this.projectPath, this.packageReader);
    this.toolingDetector = new ToolingDetector(this.projectPath, this.packageReader, this.lockfileReader);
    this.runtimeDetector = new RuntimeDetector(this.projectPath, this.packageReader);
    this.scriptsDetector = new ScriptsDetector(this.packageReader);
    this.structureDetector = new StructureDetector(this.projectPath, this.packageReader);
    
    this.databaseService = new DatabaseDetectionService([
      new PrismaDetector(),
      new DockerDetector(),
      new EnvDetector(),
      new DriversDetector(),
    ]);
  }

  public async detect(): Promise<ProjectProfile> {
    const packageJson = this.packageReader.read();
    
    const profile: ProjectProfile = {
      rootPath: this.projectPath,
      conflicts: [],
      unresolved: [],
      detectedAt: new Date().toISOString(),
    };

    this.ecosystemDetector.detect(profile, packageJson as any);
    this.frameworkDetector.detect(profile, packageJson as any);
    this.toolingDetector.detect(profile, packageJson as any);
    this.runtimeDetector.detect(profile, packageJson);
    this.scriptsDetector.detect(profile, packageJson);
    this.structureDetector.detect(profile, packageJson);

    const context: Record<string, any> = {
      projectRoot: this.projectPath,
      projectPath: this.projectPath,
      packageJson: packageJson ?? {},
    };
    
    const databases = await this.databaseService.detect(context as any);
    
    if (databases && databases.length > 0) {
      (profile as any).databases = databases;
      if (databases[0]) {
        (profile as any).database = databases[0];
      }
    }
    
    return profile;
  }
}