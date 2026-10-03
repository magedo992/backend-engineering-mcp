import * as path from "node:path";
import { Project, SourceFile, SyntaxKind } from "ts-morph";
import { ProjectProfile, DatabaseEngine } from "../../types/project.types.js";
import { AuditFinding } from "../../types/audit.types.js";

export class DatabaseAnalyzer {
  analyze(profile: ProjectProfile, projectRoot: string, _hits: any[] = [], project?: Project): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const databases = profile.databases ?? (profile.database ? [profile.database] : []);
    const engines = databases.map(d => d.value);
    const orm = profile.orm?.value;

    this.checkProfileHealth(profile, engines, findings);
    if (engines.length === 0) return findings;

    const morphProject = project ?? this.createProject(projectRoot);
    const files = this.getSourceFiles(morphProject, projectRoot);

    if (!orm || orm === 'None') {
      const driverHits = this.hasDriverViaAST(files, projectRoot);
      if (driverHits) {
        findings.push(this.createFinding({
          id: 'DB-ORM-003', severity: 'MEDIUM',
          title: 'Database driver used without ORM layer abstraction',
          message: `Source imports raw DB drivers while ORM is ${orm ?? 'undefined'}`,
          evidence: driverHits.slice(0, 2).join(' | '),
          recommendation: 'Standardize access through Mongoose/TypeORM/Knex'
        }));
      }
    }

    findings.push(...this.checkSingletonAST(files, projectRoot));
    findings.push(...this.checkHardcodedUrlsAST(files, projectRoot));

    if (orm === 'TypeORM') this.checkTypeOrmInfrastructureAST(files, projectRoot, findings);

    if (profile.structure?.hasEnv && !profile.structure?.hasEnvExample) {
      findings.push(this.createFinding({
        id: 'DB-ENV-001', severity: 'HIGH',
        title: '.env file present without corresponding .env.example',
        message: 'Database environment variables lack repository documentation',
        recommendation: 'Provide .env.example with dummy connection strings'
      }));
    }
    return findings;
  }

  private createProject(projectRoot: string): Project {
    return new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: { allowJs: true }
    });
  }

  private getSourceFiles(project: Project, projectRoot: string): SourceFile[] {
    project.addSourceFilesAtPaths(path.join(projectRoot, "src/**/*.ts"));
    return project.getSourceFiles();
  }

  private hasDriverViaAST(files: SourceFile[], projectRoot: string): string[] | null {
    const hits: string[] = [];
    const driverPattern = /from\s+['"](pg|mysql2|sqlite3|mongodb|redis|ioredis)['"]|require\(['"](pg\vert{}mysql2\vert{}sqlite3\vert{}mongodb\vert{}redis\vert{}ioredis)['"]\)/;
    for (const file of files) {
      const text = file.getText();
      if (driverPattern.test(text)) {
        hits.push(path.relative(projectRoot, file.getFilePath()));
      }
    }
    return hits.length > 0 ? hits : null;
  }

  private checkSingletonAST(files: SourceFile[], projectRoot: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    for (const file of files) {
      const text = file.getText();
      if (/new\s+(Pool|Client|Sequelize|Mongoose|PrismaClient)\s*\(/.test(text)) {
        const relative = path.relative(projectRoot, file.getFilePath());
        if (!text.includes('export') && !text.includes('getInstance')) {
          findings.push(this.createFinding({
            id: 'DB-PERF-002', severity: 'MEDIUM',
            title: 'Potential non-singleton database connection instantiation',
            message: 'Database client initialized locally without singleton pattern',
            file: relative,
            recommendation: 'Export a single shared connection instance'
          }));
        }
      }
    }
    return findings;
  }

  private checkHardcodedUrlsAST(files: SourceFile[], projectRoot: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const urlPattern = /(mongodb(\+srv)?:\/\/|postgres:\/\/|mysql:\/\/).*['"]/;
    for (const file of files) {
      for (const str of file.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
        const text = str.getLiteralValue();
        if (urlPattern.test(text) && !text.includes('process.env')) {
          findings.push(this.createFinding({
            id: 'DB-SEC-002', severity: 'HIGH',
            title: 'Hardcoded database connection string',
            message: 'Connection URL embedded directly in source code',
            file: path.relative(projectRoot, file.getFilePath()),
            line: str.getStartLineNumber(),
            evidence: this.sanitize(text),
            recommendation: 'Move connection strings to environment variables'
          }));
        }
      }
    }
    return findings;
  }

  private checkTypeOrmInfrastructureAST(files: SourceFile[], projectRoot: string, findings: AuditFinding[]): void {
    const hasDataSource = files.some(f => /DataSource\s*\(/.test(f.getText()));
    if (!hasDataSource) {
      findings.push(this.createFinding({
        id: 'DB-TYPEORM-001', severity: 'MEDIUM',
        title: 'TypeORM DataSource configuration missing',
        message: 'Project uses TypeORM but lacks explicit DataSource setup',
        recommendation: 'Define a DataSource configuration file for migrations and bootstrap'
      }));
    }
  }

  private checkProfileHealth(profile: ProjectProfile, engines: string[], findings: AuditFinding[]): void {
    if (engines.length > 2) {
      findings.push(this.createFinding({
        id: 'DB-ARCH-001', severity: 'LOW',
        title: 'Multiple database engines detected',
        message: `Project declares ${engines.join(', ')} simultaneously`,
        recommendation: 'Ensure polyglot persistence is intentional'
      }));
    }
  }

  private sanitize(s: string): string {
    return s.replace(/\s+/g, " ").trim().slice(0, 200);
  }

  private createFinding(opts: any): AuditFinding {
    return {
      id: opts.id,
      source: "database-analyzer",
      severity: opts.severity,
      category: opts.category || "DATABASE",
      title: opts.title,
      message: opts.message,
      ...(opts.file ? { file: opts.file } : {}),
      ...(opts.line ? { line: opts.line } : {}),
      ...(opts.evidence ? { evidence: opts.evidence } : {}),
      ...(opts.recommendation ? { recommendation: opts.recommendation } : {})
    } as AuditFinding;
  }
}