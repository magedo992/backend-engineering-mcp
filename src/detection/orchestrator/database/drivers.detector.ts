import { IDatabaseDetector } from './IDatabaseDetector.js';
import { DetectedValue, DatabaseEngine, ProjectContext, Evidence } from '../../../types/project.types.js';
import { getDependencies } from '../../../utils/packageJsonUtils.js';

export class DriversDetector implements IDatabaseDetector {
  private static readonly DRIVER_TO_ENGINE: Record<string, DatabaseEngine> = {
    'pg': DatabaseEngine.PostgreSQL,
    'pg-native': DatabaseEngine.PostgreSQL,
    'mysql': DatabaseEngine.MySQL,
    'mysql2': DatabaseEngine.MySQL,
    'mongodb': DatabaseEngine.MongoDB,
    'redis': DatabaseEngine.Redis,
    'ioredis': DatabaseEngine.Redis,
    'sequelize': DatabaseEngine.Unknown, 
    'mssql': DatabaseEngine.SQLServer, 
    'oracledb': DatabaseEngine.Oracle,
    'knex': DatabaseEngine.Unknown, 
    'typeorm': DatabaseEngine.Unknown, 
  };

  public async detect(context: ProjectContext): Promise<DetectedValue<DatabaseEngine> | null> {
    const dependencies = await getDependencies(context.packageJson || context.projectRoot);
    for (const [name, version] of Object.entries(dependencies)) {
      const engine = DriversDetector.DRIVER_TO_ENGINE[name];
      if (engine && engine !== DatabaseEngine.Unknown) {
        return this.createDbResult(engine, `${name}@${version}`, 'HIGH', 'package.json');
      }
    }
    return null;
  }

  public getPriority(): number {
    return 10;
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
      evidence: [this.createEvidenceEntry(source, 'DEPENDENCY', detail, confidence === 'HIGH' ? 'STRONG' : 'MEDIUM')],
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