import { ProjectContext, DetectedValue, DatabaseEngine } from '../../../types/project.types.js';
export interface IDatabaseDetector {
  getPriority(): number;
  detect(context: ProjectContext): Promise<DetectedValue<DatabaseEngine> | DetectedValue<DatabaseEngine>[] | null>;
}