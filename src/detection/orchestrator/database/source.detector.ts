import { DetectedValue, DatabaseEngine, ProjectContext, DetectionEvidence } from '../../../types/project.types.js';
import { IDatabaseDetector } from './IDatabaseDetector.js';
import { DbSourceScanner } from '../../../scanners/db-source.scanner.js';

export class SourceDetector implements IDatabaseDetector {
  private readonly scanner = new DbSourceScanner();
  readonly name = 'source';

  getPriority(): number {
    return 20;
  }

  async detect(context: ProjectContext): Promise<DetectedValue<DatabaseEngine>[]> {
    const projectRoot = context.projectRoot;
    const hits = this.scanner.scan(projectRoot);

    if (hits.length === 0) {
      return [];
    }

    const byEngine = new Map<DatabaseEngine, typeof hits>();

    for (const h of hits) {
      const engine = h.engine as DatabaseEngine;
      if (engine === DatabaseEngine.Unknown) continue;

      const arr = byEngine.get(engine);
      if (arr) {
        arr.push(h);
      } else {
        byEngine.set(engine, [h]);
      }
    }

    const results: DetectedValue<DatabaseEngine>[] = [];

    for (const [engine, engineHits] of byEngine) {
      const evidence: DetectionEvidence[] = engineHits.slice(0, 3).map(h => ({
        source: `${h.file}:${h.line}`,
        kind: 'SOURCE_CODE',
        detail: h.snippet,
        strength: 'STRONG',
      }));

      const result: DetectedValue<DatabaseEngine> = {
        value: engine,
        confidence: 'HIGH',
        evidence,
      };

      results.push(result);
    }

    return results;
  }
}