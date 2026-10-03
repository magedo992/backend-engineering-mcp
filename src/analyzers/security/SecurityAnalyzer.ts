import * as fs from 'node:fs';
import * as path from 'node:path';
import { Project, SourceFile } from 'ts-morph';
import { ProjectProfile } from '../../types/project.types.js';
import { AuditFinding } from '../../types/audit.types.js';
import type { SourceHit } from '../../scanners/db-source.scanner.js';
import { ISecurityRule, SecurityContext } from './interfaces/security-rule.interface.js';
import { EnvExposureRule } from './rules/EnvExposureRule.js';
import { HardcodedSecretsRule } from './rules/HardcodedSecretsRule.js';
import { SqlInjectionRule } from './rules/SqlInjectionRule.js';
import { MissingSecurityHeadersRule } from './rules/MissingSecurityHeadersRule.js';

export class SecurityAnalyzer {
  analyze(profile: ProjectProfile, projectRoot: string, _hits: SourceHit[] = [], project?: Project): AuditFinding[] {
    const morphProject = project ?? this.createProject(projectRoot);
    const files = this.getSourceFiles(morphProject, projectRoot);
    const ctx: SecurityContext = { files, profile, projectRoot };

    const rules: ISecurityRule[] = [
      new EnvExposureRule(),
      new HardcodedSecretsRule(),
      new SqlInjectionRule(),
      new MissingSecurityHeadersRule(),
    ];

    return rules.flatMap(r => r.check(ctx));
  }

  private createProject(projectRoot: string): Project {
    const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
    return new Project({
      ...(fs.existsSync(tsConfigPath) ? { tsConfigFilePath: tsConfigPath } : {}),
      skipFileDependencyResolution: true,
      skipAddingFilesFromTsConfig: true,
    });
  }

  private getSourceFiles(project: Project, projectRoot: string): SourceFile[] {
    const root = projectRoot.replace(/\\/g, '/');
    if (project.getSourceFiles().length === 0) {
      project.addSourceFilesAtPaths([
        `${root}/src/**/*.{ts,js}`,
        `${root}/*.{ts,js}`,
        `!${root}/**/node_modules/**`,
        `!${root}/**/dist/**`,
      ]);
    }
    return project.getSourceFiles().filter(f => !/(seed|test|spec|migration|\.test\.|\.spec\.)/i.test(f.getFilePath()));
  }
}