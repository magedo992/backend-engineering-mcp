import * as path from 'node:path';
import * as fs from 'node:fs';
import { IDatabaseDetector } from './IDatabaseDetector.js';
import { DetectedValue, DatabaseEngine, ProjectContext, Evidence } from '../../../types/project.types.js';

interface DockerComposeService {
  image?: string;
  [key: string]: unknown;
}

interface DockerComposeFile {
  services?: Record<string, DockerComposeService>;
}

export class DockerDetector implements IDatabaseDetector {
  public async detect(context: ProjectContext): Promise<DetectedValue<DatabaseEngine> | null> {
    const dockerComposePath = path.join(context.projectRoot, 'docker-compose.yml');
    const dockerCompose = await this.readDockerComposeFile(dockerComposePath);
    if (dockerCompose?.services) {
      const services = dockerCompose.services;
      for (const [serviceName, serviceConfig] of Object.entries(services)) {
        if (serviceConfig?.image && serviceConfig.image.includes('postgres')) {
          return this.createDbResult(DatabaseEngine.PostgreSQL, `docker-compose.yml#services.${serviceName}`, 'HIGH', 'docker-compose.yml');
        } else if (serviceConfig?.image && serviceConfig.image.includes('mysql')) {
          return this.createDbResult(DatabaseEngine.MySQL, `docker-compose.yml#services.${serviceName}`, 'HIGH', 'docker-compose.yml');
        }
      }
    }
    return null;
  }

  public getPriority(): number {
    return 8;
  }

  private async readDockerComposeFile(filePath: string): Promise<DockerComposeFile | null> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const services: Record<string, DockerComposeService> = {};
      const lines = content.split('\n');
      let currentService: string | null = null;
      let inServices = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const indent = line.search(/\S/);
        if (indent === 0) {
          inServices = trimmed.startsWith('services:');
          currentService = null;
          continue;
        }

        if (inServices) {
          if (indent === 2 && trimmed.endsWith(':')) {
            currentService = trimmed.slice(0, -1);
            services[currentService] = {};
          } else if (currentService && trimmed.startsWith('image:')) {
            const image = trimmed.replace(/^image:\s*['"]?/, '').replace(/['"]?$/, '');
            const existing = services[currentService];
            if (existing) {
              existing.image = image;
            }
          }
        }
      }
      return { services };
    } catch {
      return null;
    }
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