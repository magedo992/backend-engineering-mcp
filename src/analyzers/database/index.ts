import * as fs from 'node:fs';
import * as path from 'node:path';
import { Project } from 'ts-morph';
import { ProjectProfile } from '../../types/project.types.js';
import { AuditFinding } from '../../types/audit.types.js';
import { DatabaseAnalyzer } from './database.analyzer.js';
import { QueryAnalyzer } from './query.analyzer.js';
import { MongooseAnalyzer, SqlAndNoSqlAnalyzer } from './mongoose.analyzer.js';


export * from './database.analyzer.js';
export * from './query.analyzer.js';
export * from './mongoose.analyzer.js';
export { MongooseAnalyzer as SqlNoSqlAnalyzer };

function createSharedProject(projectRoot: string): Project {
  const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
  const project = fs.existsSync(tsConfigPath)
    ? new Project({ tsConfigFilePath: tsConfigPath, skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true })
    : new Project({ skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true });

  const normalizedRoot = projectRoot.replace(/\\/g, '/');
  project.addSourceFilesAtPaths([
    `${normalizedRoot}/src/**/*.{ts,js,mts,mjs}`,
    `${normalizedRoot}/**/*.{ts,js,mts,mjs}`,
    `!${normalizedRoot}/**/node_modules/**`,
    `!${normalizedRoot}/**/dist/**`,
    `!${normalizedRoot}/**/reports/**`,
  ]);
  return project;
}

export function analyzeDatabase(profile: ProjectProfile, projectRoot: string, project?: Project): AuditFinding[] {
  const sharedProject = project ?? createSharedProject(projectRoot);
  if (sharedProject.getSourceFiles().length === 0) {
    sharedProject.addSourceFilesAtPaths([path.join(projectRoot, "src/**/*.{ts,js}").replace(/\\/g, "/")]);
  }
  const files = sharedProject.getSourceFiles().filter(f => {
    const p = f.getFilePath().replace(/\\/g, "/");
    return !p.includes("/node_modules/") && !p.includes("/dist/") && !p.includes("/reports/");
  });

  return [
    ...new DatabaseAnalyzer().analyze(profile, projectRoot, [], sharedProject),
    ...new QueryAnalyzer().analyze(projectRoot, [], sharedProject),
    ...new MongooseAnalyzer().analyze(profile, files, projectRoot),
  ];
}

export class DatabaseModule {
  analyze(profile: ProjectProfile, projectRoot: string, project?: Project): AuditFinding[] {
    return analyzeDatabase(profile, projectRoot, project);
  }
}