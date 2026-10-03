import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PrismaDatasource {
  name: string;
  provider: string;
  url?: string;
}

export class PrismaReader {
  private readonly schemaPath: string;

  constructor(
    private readonly projectPath: string,
  ) {
    this.schemaPath = path.join(
      projectPath,
      'prisma',
      'schema.prisma',
    );
  }

  exists(): boolean {
    return fs.existsSync(
      this.schemaPath,
    );
  }

  read(): string {
    if (!this.exists()) {
      throw new Error(
        'prisma/schema.prisma was not found.',
      );
    }

    try {
      return fs.readFileSync(
        this.schemaPath,
        'utf-8',
      );
    } catch {
      throw new Error(
        'prisma/schema.prisma exists but could not be read.',
      );
    }
  }

  getDatasource(): PrismaDatasource | undefined {
    if (!this.exists()) {
      return undefined;
    }

    const content = this.read();

    const datasourceMatch =
      content.match(
        /datasource\s+(\w+)\s*\{([\s\S]*?)\}/,
      );

    if (!datasourceMatch) {
      return undefined;
    }

    const name =
      datasourceMatch[1];

    const block =
      datasourceMatch[2];

    if (
      name === undefined ||
      block === undefined
    ) {
      return undefined;
    }

    const providerMatch =
      block.match(
        /provider\s*=\s*"([^"]+)"/,
      );

    if (!providerMatch) {
      return undefined;
    }

    const provider =
      providerMatch[1];

    if (provider === undefined) {
      return undefined;
    }

    const urlMatch =
      block.match(
        /url\s*=\s*"([^"]+)"/,
      );

    const datasource: PrismaDatasource = {
      name,
      provider,
    };

    if (urlMatch?.[1] !== undefined) {
      datasource.url =
        urlMatch[1];
    }

    return datasource;
  }
}