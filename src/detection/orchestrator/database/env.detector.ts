import * as path from 'node:path';
import { IDatabaseDetector } from './IDatabaseDetector.js';
import { DetectedValue, DatabaseEngine, ProjectContext, Evidence } from '../../../types/project.types.js';
import { readEnvFile } from '../../../utils/envUtils.js';

const ALLOWED_ENV_FILES = ['.env.example', '.env.sample', '.env.template', '.env.test.example'];

export class EnvDetector implements IDatabaseDetector {
  public readonly name = 'EnvDetector';
  public readonly priority = 40;

  public async detect(context: ProjectContext): Promise<DetectedValue<DatabaseEngine>[]> {
    const results: DetectedValue<DatabaseEngine>[] = [];

    for (const file of ALLOWED_ENV_FILES) {
      const envFilePath = path.join(context.projectRoot, file);
      const envContent = await readEnvFile(envFilePath);
      if (!envContent) continue;

      const dbUrl = envContent.DB_URL || envContent.DATABASE_URL;
      if (dbUrl) {
        const engine = DatabaseEngine.fromDbUrl(dbUrl);
        if (engine && engine !== DatabaseEngine.Unknown) {
          results.push(this.createDbResult(
            engine,
            `Database URL pattern found in template file (${file})`,
            'MEDIUM',
            file
          ));
        }
      }

      // Check key names safely without exposing raw connection strings
      if (envContent.REDIS_HOST || envContent.REDIS_URL) {
        results.push(this.createDbResult(DatabaseEngine.Redis, `Redis variable found in ${file}`, 'MEDIUM', file));
      }

      if (envContent.MONGO_URI || envContent.MONGODB_URI) {
        results.push(this.createDbResult(DatabaseEngine.MongoDB, `MongoDB variable found in ${file}`, 'MEDIUM', file));
      }
    }

    return results;
  }

  public getPriority(): number {
    return this.priority;
  }

  private createDbResult(
    engine: DatabaseEngine,
    detail: string,
    confidence: 'HIGH' | 'MEDIUM' | 'LOW',
    source: string,
  ): DetectedValue<DatabaseEngine> {
    return {
      value: engine,
      confidence,
      evidence: [this.createEvidenceEntry(source, 'CONFIG_FILE', detail, confidence === 'HIGH' ? 'STRONG' : 'MEDIUM')],
    };
  }

  private createEvidenceEntry(
    source: string,
    kind: 'DEPENDENCY' | 'CONFIG_FILE',
    detail: string,
    strength: 'STRONG' | 'MEDIUM' | 'WEAK',
  ): Evidence {
    return { source, kind, detail, strength };
  }
}