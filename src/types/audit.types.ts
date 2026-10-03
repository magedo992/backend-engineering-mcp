export type AuditSeverity = 'BLOCKER' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type RiskLevel = 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AuditCategory =
  | 'SECURITY'
  | 'RELIABILITY'
  | 'MAINTAINABILITY'
  | 'CODE_SMELL'
  | 'DUPLICATION'
  | 'COVERAGE'
  | 'ARCHITECTURE'
  | 'DATABASE'
  | 'API'
  | 'SWAGGER'
  | 'TESTING'
  | 'DOCUMENTATION'
  | 'OTHER';

export interface AuditFinding {
  id: string;
  source: string;
  severity: AuditSeverity;
  category: AuditCategory;

  title: string;
  message: string;

  file?: string;
  line?: number;

  rule?: string;

  evidence?: string;
  recommendation?: string;
}

export interface SonarMetrics {
  bugs?: number;
  vulnerabilities?: number;
  codeSmells?: number;
  securityHotspots?: number;

  coverage?: number;
  duplicatedLinesDensity?: number;

  lines?: number;
  ncloc?: number;

  reliabilityRating?: string;
  securityRating?: string;
  maintainabilityRating?: string;
}

export interface SonarAnalysisResult {
  projectKey: string;
  projectName?: string;

  metrics: SonarMetrics;

  findings: AuditFinding[];

  analyzedAt: string;
}

export interface AuditProjectInfo {
  name: string;
  path: string;

  language?: string;
  framework?: string;
  database?: string;
  orm?: string;
}

export interface AuditReport {
  version: string;

  generatedAt: string;

  score: number;

  riskLevel: RiskLevel;

  healthSummary: string;

  project: AuditProjectInfo;

  summary: {
    totalFindings: number;
    blockers: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };

  sonarqube: SonarAnalysisResult;

  findings: AuditFinding[];
}