export type DetectionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type EvidenceKind = 
  | 'DEPENDENCY' 
  | 'LOCKFILE' 
  | 'CONFIG_FILE' 
  | 'SOURCE_CODE' 
  | 'FILE_STRUCTURE' 
  | 'README';

export interface DetectionEvidence {
  source: string;
  kind: EvidenceKind;
  detail: string;
  strength: 'STRONG' | 'MEDIUM' | 'SUPPORTING' | 'WEAK';
}
export type Evidence = DetectionEvidence;

export interface DetectedValue<T> {
  value: T;
  confidence: DetectionConfidence;
  evidence: DetectionEvidence[];
  declaredVersion?: string;
  installedVersion?: string;
}

export type DatabaseEngine =
  | 'PostgreSQL' 
  | 'MySQL' 
  | 'MongoDB' 
  | 'SQLite' 
  | 'MariaDB' 
  | 'MSSQL' 
  | 'SQLServer' 
  | 'Oracle' 
  | 'Redis' 
  | 'DynamoDB' 
  | 'Cassandra' 
  | 'Neo4j' 
  | 'Pinecone' 
  | 'Qdrant' 
  | 'CockroachDB' 
  | 'Supabase' 
  | 'Unknown';

export const DatabaseEngine = {
  PostgreSQL: 'PostgreSQL' as DatabaseEngine,
  MySQL: 'MySQL' as DatabaseEngine,
  MongoDB: 'MongoDB' as DatabaseEngine,
  SQLite: 'SQLite' as DatabaseEngine,
  MariaDB: 'MariaDB' as DatabaseEngine,
  MSSQL: 'MSSQL' as DatabaseEngine,
  SQLServer: 'MSSQL' as DatabaseEngine, 
  Oracle: 'Oracle' as DatabaseEngine,
  Redis: 'Redis' as DatabaseEngine,
  DynamoDB: 'DynamoDB' as DatabaseEngine,
  Cassandra: 'Cassandra' as DatabaseEngine,
  Neo4j: 'Neo4j' as DatabaseEngine,
  Pinecone: 'Pinecone' as DatabaseEngine,
  Qdrant: 'Qdrant' as DatabaseEngine,
  CockroachDB: 'CockroachDB' as DatabaseEngine,
  Supabase: 'Supabase' as DatabaseEngine,
  Unknown: 'Unknown' as DatabaseEngine,

  fromDbUrl(dbUrl: string): DatabaseEngine {
    const lower = dbUrl.toLowerCase();
    
    if (lower.includes('supabase.co') || lower.includes('supabase.com')) return DatabaseEngine.Supabase;
    if (lower.startsWith('postgres://') || lower.startsWith('postgresql://')) return DatabaseEngine.PostgreSQL;
    if (lower.startsWith('mysql://')) return DatabaseEngine.MySQL;
    if (lower.startsWith('mariadb://')) return DatabaseEngine.MariaDB;
    if (lower.startsWith('mongodb://') || lower.startsWith('mongodb+srv://')) return DatabaseEngine.MongoDB;
    if (lower.startsWith('redis://') || lower.startsWith('rediss://')) return DatabaseEngine.Redis;
    if (lower.startsWith('sqlite://') || lower.startsWith('file:') || lower.endsWith('.sqlite') || lower.endsWith('.db')) return DatabaseEngine.SQLite;
    if (lower.startsWith('cockroachdb://')) return DatabaseEngine.CockroachDB;
    if (lower.includes('sqlserver') || lower.includes('mssql')) return DatabaseEngine.MSSQL;
    if (lower.startsWith('oracle://') || lower.includes('oracle')) return DatabaseEngine.Oracle;
    
    return DatabaseEngine.Unknown;
  },

  fromPrismaProvider(provider: string): DatabaseEngine {
    const lower = provider.toLowerCase();
    if (lower === 'postgresql' || lower === 'postgres') return DatabaseEngine.PostgreSQL;
    if (lower === 'mysql') return DatabaseEngine.MySQL;
    if (lower === 'mariadb') return DatabaseEngine.MariaDB;
    if (lower === 'mongodb') return DatabaseEngine.MongoDB;
    if (lower === 'sqlite') return DatabaseEngine.SQLite;
    if (lower === 'cockroachdb') return DatabaseEngine.CockroachDB;
    if (lower === 'sqlserver' || lower === 'mssql') return DatabaseEngine.MSSQL;
    return DatabaseEngine.Unknown;
  },

  fromScriptCommand(command: string): DatabaseEngine {
    const lower = command.toLowerCase();
    if (lower.includes('psql') || lower.includes('postgres')) return DatabaseEngine.PostgreSQL;
    if (lower.includes('mysql')) return DatabaseEngine.MySQL;
    if (lower.includes('mariadb')) return DatabaseEngine.MariaDB;
    if (lower.includes('mongo')) return DatabaseEngine.MongoDB;
    if (lower.includes('redis')) return DatabaseEngine.Redis;
    if (lower.includes('mssql') || lower.includes('sqlserver')) return DatabaseEngine.MSSQL;
    if (lower.includes('sqlite')) return DatabaseEngine.SQLite;
    return DatabaseEngine.Unknown;
  },
};

export type OrmTool = 'Prisma' | 'TypeORM' | 'Mongoose' | 'Drizzle' | 'Sequelize' | 'Knex' | 'MikroORM' | 'Kysely' | 'None';

export interface ProjectContext {
  projectRoot: string;
  projectPath?: string;
  packageJson?: Record<string, unknown>;
  prismaSchema?: string;
}

export interface DetectionOptions<T> {
  value: T;
  evidence: DetectionEvidence[];
  declaredVersion?: string;
  installedPackageName?: string;
}

export interface ProjectStructure {
  src: boolean;
  controllers: boolean;
  services: boolean;
  routes: boolean;
  middlewares: boolean;
  prisma: boolean;
  hasEnv: boolean;
  utils?: boolean;
  tests?: boolean;
  hasDockerfile?: boolean;
  hasEnvExample?: boolean;
  hasCI?: boolean;
}

export interface ProjectProfile {
  rootPath: string;
  ecosystem?: DetectedValue<'Node.js'>;
  language?: DetectedValue<'TypeScript' | 'JavaScript'>;
  packageManager?: DetectedValue<'npm' | 'yarn' | 'pnpm'>;
  framework?: DetectedValue<string>;
  runtime?: DetectedValue<string>;
  orm?: DetectedValue<OrmTool>;
  secondaryOrms?: DetectedValue<OrmTool>[];
  database?: DetectedValue<DatabaseEngine>;
  secondaryDatabases?: DetectedValue<DatabaseEngine>[];
  databases?: DetectedValue<DatabaseEngine>[];
  testing?: DetectedValue<'Jest' | 'Vitest'>;
  linter?: DetectedValue<'ESLint'>;
  typescript?: DetectedValue<'TypeScript'>;
  prismaTooling?: DetectedValue<'Prisma'>;
  prettier?: DetectedValue<'Prettier'>;
  swagger?: DetectedValue<boolean>;
  docker?: DetectedValue<boolean>;
  dockerCompose?: DetectedValue<boolean>;
  sonarQube?: DetectedValue<boolean>;
  scripts?: Record<string, string>;
  entryPoint?: string | { source?: string; build?: string; evidence?: DetectionEvidence[] };
  structure?: ProjectStructure;
  conflicts: string[];
  unresolved: string[];
  detectedAt: string;
}