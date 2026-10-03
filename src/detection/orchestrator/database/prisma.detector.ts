import * as fs from 'node:fs';
import * as path from 'node:path';
import { IDatabaseDetector } from './IDatabaseDetector.js';
import {
  DetectedValue,
  DatabaseEngine,
  ProjectContext,
  Evidence,
} from '../../../types/project.types.js';

const PRISMA_SCHEMA_PATHS = ['prisma/schema.prisma', 'schema.prisma'];

export class PrismaDetector implements IDatabaseDetector {
  public async detect(context: ProjectContext): Promise<DetectedValue<DatabaseEngine> | null> {
    for (const relPath of PRISMA_SCHEMA_PATHS) {
      const fullPath = path.join(context.projectRoot, relPath);

      if (!fs.existsSync(fullPath)) continue;

      try {
        const content = await fs.promises.readFile(fullPath, 'utf-8');
        const provider = this.getPrismaProvider(content);
        if (!provider) continue;

        const engine = DatabaseEngine.fromPrismaProvider(provider);
        if (engine !== DatabaseEngine.Unknown) {
          return this.createDbResult(engine, relPath, 'HIGH', relPath);
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  public getPriority(): number {
    return 9;
  }

  
  private getPrismaProvider(content: string): string | null {
    const match = content.match(/datasource\s+[\w\-]+\s*\{[\s\S]*?provider\s*=\s*"([^"]+)"/);
    return match?.[1] ?? null;
  }

  private createDbResult(
    engine: DatabaseEngine,
    detail: string,
    confidence: 'HIGH' | 'MEDIUM' | 'LOW',
    source: string
  ): DetectedValue<DatabaseEngine> {
    return {
      value: engine,
      confidence,
      evidence: [{ source, kind: 'CONFIG_FILE', detail, strength: 'STRONG' }],
    };
  }
}