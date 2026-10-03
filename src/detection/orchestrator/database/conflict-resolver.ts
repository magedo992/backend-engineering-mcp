  import { DetectedValue, DatabaseEngine } from '../../../types/project.types.js';

  export interface ConflictResult {
    conflicts: string[];
    unresolved: string[];
  }

  export function resolveDatabaseConflicts(all: DetectedValue<DatabaseEngine>[]): ConflictResult {
    const conflicts: string[] = [];
    const unresolved: string[] = [];

    if (all.length === 0) {
      unresolved.push('No database evidence found from any source (prisma, env, drivers, source).');
      return { conflicts, unresolved };
    }

    const uniqueEngines = [...new Set(all.map(r => r.value))];

    if (uniqueEngines.length > 1) {
      const details = all.map(r => `${r.value} via ${r.evidence[0]?.source ?? 'unknown'}`).join(' vs ');
      conflicts.push(`Multiple database engines detected: ${uniqueEngines.join(', ')} (${details})`);
    }

    const configEngines = new Set(all.filter(r => r.evidence.some(e => e.kind === 'CONFIG_FILE')).map(r => r.value));
    const sourceEngines = new Set(all.filter(r => r.evidence.some(e => e.kind === 'SOURCE_CODE')).map(r => r.value));
    
    if (configEngines.size > 0 && sourceEngines.size > 0) {
      for (const ce of configEngines) {
        if (!sourceEngines.has(ce)) {
          conflicts.push(`CONFIG_FILE says ${ce} but SOURCE_CODE uses ${[...sourceEngines].join(', ')}`);
        }
      }
    }

    if (all.every(r => r.confidence === 'LOW')) {
      unresolved.push('All database signals are LOW confidence - manual verification needed.');
    }

    return { conflicts, unresolved };
  }