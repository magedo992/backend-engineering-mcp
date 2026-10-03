import {
  ProjectProfile,
  DetectedValue,
} from '../types.js';

import {
  PackageJson,
  PackageReader,
} from '../readers/package-reader.js';

import {
  LockfileReader,
} from '../readers/lockfile-reader.js';

export class FrameworkDetector {
  private readonly lockfileReader: LockfileReader;

  constructor(
    projectPath: string,
    private readonly packageReader: PackageReader,
  ) {
    this.lockfileReader =
      new LockfileReader(
        projectPath,
      );
  }

  detect(
    profile: ProjectProfile,
    packageJson: PackageJson,
  ): void {
    const dependencies =
      this.packageReader.getDependencies(
        packageJson,
      );

    if (dependencies['@nestjs/core']) {
      const detection: DetectedValue<
        'NestJS'
      > = {
        value: 'NestJS',

        declaredVersion:
          dependencies['@nestjs/core'],

        confidence: 'HIGH',

        evidence: [
          {
            source: 'package.json',
            kind: 'DEPENDENCY',
            detail:
              `@nestjs/core: ${dependencies['@nestjs/core']}`,
            strength: 'STRONG',
          },
        ],
      };

      const installedVersion =
        this.lockfileReader.getInstalledVersion(
          '@nestjs/core',
        );

      if (installedVersion) {
        detection.installedVersion =
          installedVersion;
      }

      profile.framework = detection;

      return;
    }

    if (dependencies.express) {
      const detection: DetectedValue<
        'Express'
      > = {
        value: 'Express',

        declaredVersion:
          dependencies.express,

        confidence: 'HIGH',

        evidence: [
          {
            source: 'package.json',
            kind: 'DEPENDENCY',
            detail:
              `express: ${dependencies.express}`,
            strength: 'STRONG',
          },
        ],
      };

      const installedVersion =
        this.lockfileReader.getInstalledVersion(
          'express',
        );

      if (installedVersion) {
        detection.installedVersion =
          installedVersion;
      }

      profile.framework = detection;

      return;
    }

    if (dependencies.fastify) {
      const detection: DetectedValue<
        'Fastify'
      > = {
        value: 'Fastify',

        declaredVersion:
          dependencies.fastify,

        confidence: 'HIGH',

        evidence: [
          {
            source: 'package.json',
            kind: 'DEPENDENCY',
            detail:
              `fastify: ${dependencies.fastify}`,
            strength: 'STRONG',
          },
        ],
      };

      const installedVersion =
        this.lockfileReader.getInstalledVersion(
          'fastify',
        );

      if (installedVersion) {
        detection.installedVersion =
          installedVersion;
      }

      profile.framework = detection;
    }
  }
}