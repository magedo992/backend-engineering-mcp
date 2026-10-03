import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProjectProfile } from '../../types/project.types.js';
import { PackageJson, PackageReader } from '../readers/package-reader.js';

export class RuntimeDetector {
  constructor(
    private readonly projectPath: string,
    private readonly packageReader: PackageReader
  ) {}

  detect(profile: ProjectProfile, packageJson: PackageJson): void {
    const engineVersion = this.packageReader.getNodeEngine(packageJson);
    
    if (engineVersion) {
      profile.runtime = {
        value: engineVersion,
        confidence: 'HIGH',
        evidence: [{
          source: 'package.json',
          kind: 'CONFIG_FILE',
          detail: `engines.node: ${engineVersion}`,
          strength: 'STRONG',
        }],
      };
      return;
    }

    for (const file of ['.nvmrc', '.node-version']) {
      const fullPath = path.join(this.projectPath, file);
      
      if (fs.existsSync(fullPath)) {
        const version = fs.readFileSync(fullPath, 'utf-8').trim();
        if (version) {
          profile.runtime = {
            value: version,
            confidence: 'MEDIUM',
            evidence: [{
              source: file,
              kind: 'CONFIG_FILE',
              detail: `${file}: ${version}`,
              strength: 'STRONG',
            }],
          };
          return;
        }
      }
    }
  }
}