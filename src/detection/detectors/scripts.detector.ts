import { ProjectProfile } from '../../types/project.types.js';
import { PackageJson, PackageReader } from '../readers/package-reader.js';

export class ScriptsDetector {
  constructor(private readonly packageReader: PackageReader) {}

  detect(profile: ProjectProfile, packageJson: PackageJson): void {
    const scripts = this.packageReader.getScripts(packageJson);
    
    if (Object.keys(scripts).length > 0) {
      profile.scripts = scripts;
    }

    const getEvidence = (name: string, found: boolean) => [
      {
        source: 'package.json',
        kind: 'CONFIG_FILE' as const,
        detail: found ? `scripts.${name}: ${scripts[name]}` : `scripts.${name} missing`,
        strength: found ? ('STRONG' as const) : ('SUPPORTING' as const),
      }
    ];

    (profile as any).scriptsDetected = {
      dev: { 
        value: !!scripts.dev, 
        confidence: 'HIGH', 
        evidence: getEvidence('dev', !!scripts.dev) 
      },
      build: { 
        value: !!scripts.build, 
        confidence: 'HIGH', 
        evidence: getEvidence('build', !!scripts.build) 
      },
      start: { 
        value: !!scripts.start, 
        confidence: 'HIGH', 
        evidence: getEvidence('start', !!scripts.start) 
      },
      test: { 
        value: !!scripts.test, 
        confidence: 'HIGH', 
        evidence: getEvidence('test', !!scripts.test) 
      },
      lint: { 
        value: !!(scripts.lint || scripts['lint:check']), 
        confidence: 'HIGH', 
        evidence: getEvidence('lint', !!(scripts.lint || scripts['lint:check'])) 
      },
    };
  }
}