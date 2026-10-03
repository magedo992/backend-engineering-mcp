import * as fs from 'node:fs';
import { Project } from 'ts-morph';
import { ProjectProfile } from '../types/project.types.js';
import { AuditFinding } from '../types/audit.types.js';
import { analyzeDatabase } from '../analyzers/database/index.js';
import { SecurityAnalyzer } from '../analyzers/security/SecurityAnalyzer.js';

const DEDUP_GROUP: Record<string, string> = {
  'DB-SEC-001': 'sql-injection',
  'SEC-SQLI-001': 'sql-injection',
  'SEC-SQLI-002': 'sql-injection',
};

export class AuditOrchestrator {
  private securityAnalyzer = new SecurityAnalyzer();

  public runFullAudit(profile: ProjectProfile, projectRoot: string, project?: Project): AuditFinding[] {
    const sharedProject = project ?? this.createProject(projectRoot);

    const dbFindings = analyzeDatabase(profile, projectRoot, sharedProject as any);
    const securityFindings = this.securityAnalyzer.analyze(profile, projectRoot, [], sharedProject);
    const archFindings = this.analyzeArchitecture(profile);

    return this.deduplicate([...dbFindings, ...securityFindings, ...archFindings]);
  }

  private analyzeArchitecture(profile: ProjectProfile): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const scripts = (profile as any).scripts ?? {};

    if (!scripts['test']) {
      findings.push({
        id: 'ARCH-001',
        source: 'architecture-analyzer',
        severity: 'MEDIUM',
        category: 'ARCHITECTURE',
        title: 'Missing test script',
        message: 'No test script in package.json',
        recommendation: 'Add Vitest/Jest and "test" script in package.json',
      });
    }

    if (!scripts['lint'] && !(profile as any).linter) {
      findings.push({
        id: 'ARCH-002',
        source: 'architecture-analyzer',
        severity: 'LOW',
        category: 'ARCHITECTURE',
        title: 'Missing lint script',
        message: 'No lint script detected in package.json',
        recommendation: 'Add ESLint or Biome with "lint" script',
      });
    }

    return findings;
  }

  private deduplicate(findings: AuditFinding[]): AuditFinding[] {
    const map = new Map<string, AuditFinding>();
    const rank = { BLOCKER: 5, CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 } as const;

    for (const f of findings) {
      const group = DEDUP_GROUP[f.id] ?? f.id;
      const key = `${f.file ?? 'global'}:${f.line ?? 0}:${group}`;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, f);
      } else if (rank[f.severity as keyof typeof rank] > rank[existing.severity as keyof typeof rank]) {
        map.set(key, f);
      }
    }

    return Array.from(map.values()).sort((a, b) => rank[b.severity as keyof typeof rank] - rank[a.severity as keyof typeof rank]);
  }

  private createProject(projectRoot: string): Project {
    const tsConfigPath = `${projectRoot}/tsconfig.json`;
    return new Project({
      ...(fs.existsSync(tsConfigPath) ? { tsConfigFilePath: tsConfigPath } : {}),
      skipFileDependencyResolution: true,
      skipAddingFilesFromTsConfig: true,
    });
  }
}