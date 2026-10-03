import { IDatabaseDetector } from './IDatabaseDetector.js';
import { DetectedValue, DatabaseEngine, ProjectContext } from '../../../types/project.types.js';

export class DatabaseDetectionService {
  private detectors: IDatabaseDetector[];

  constructor(detectors: IDatabaseDetector[]) {
    this.detectors = detectors.sort((a, b) => b.getPriority() - a.getPriority());
  }

  public async detect(context: ProjectContext): Promise<DetectedValue<DatabaseEngine>[]> {
    const results: DetectedValue<DatabaseEngine>[] = [];

    for (const detector of this.detectors) {
      const result = await detector.detect(context);
      if (result) {
        if (Array.isArray(result)) {
          results.push(...result);
        } else {
          results.push(result);
        }
      }
    }

    // Remove duplicates and filter out 'Unknown'
    const uniqueResults: DetectedValue<DatabaseEngine>[] = Array.from(
      new Set(results.map(r => JSON.stringify(r)))
    ).map(json => JSON.parse(json));

    return uniqueResults.filter(r => r.value !== DatabaseEngine.Unknown);
  }
}