import { IDatabaseDetector } from './IDatabaseDetector.js';
import { DetectedValue, DatabaseEngine, ProjectContext, Evidence } from '../../../types/project.types.js';
import { getScripts } from '../../../utils/packageJsonUtils.js';

export class ScriptsDetector implements IDatabaseDetector {
  public async detect(context: ProjectContext): Promise<DetectedValue<DatabaseEngine> | null> {
    const scripts = await getScripts(context.packageJson || context.projectRoot);
    for (const [scriptName, command] of Object.entries(scripts)) {
      if (command.includes('psql') || command.includes('mysql') || command.includes('mongo') || command.includes('postgres')) {
        const engine = DatabaseEngine.fromScriptCommand(command);
        if (engine !== DatabaseEngine.Unknown) {
          return this.createDbResult(engine, `package.json#scripts.${scriptName}`, 'HIGH', 'package.json');
        }
      }
    }
    return null;
  }

  public getPriority(): number {
    return 7;
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