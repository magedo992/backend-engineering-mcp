import { AuditFinding } from '../types/audit.types.js';

export type RiskLevel = 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ScoreResult {
  score: number;
  riskLevel: RiskLevel;
  healthSummary: string;
}

export class ScoreService {
  private static readonly SEVERITY_WEIGHTS: Record<string, number> = {
    BLOCKER: 25,
    CRITICAL: 20,
    HIGH: 15,
    MEDIUM: 7,
    LOW: 2,
    INFO: 0,
  };

  calculate(findings: AuditFinding[]): ScoreResult {
    const deductions = findings.reduce(
      (sum, f) => sum + this.getSeverityWeight(f.severity),
      0,
    );

    const score = Math.max(0, Math.min(100, 100 - deductions));
    const riskLevel = this.determineRiskLevel(findings);
    const healthSummary = this.generateSummary(riskLevel, findings.length);

    return { score, riskLevel, healthSummary };
  }

  getSeverityWeight(severity: string): number {
    return ScoreService.SEVERITY_WEIGHTS[severity] ?? 0;
  }

  private determineRiskLevel(findings: AuditFinding[]): RiskLevel {
    if (findings.some((f) => f.severity === 'BLOCKER' || f.severity === 'CRITICAL')) {
      return 'CRITICAL';
    }
    if (findings.some((f) => f.severity === 'HIGH')) {
      return 'HIGH';
    }
    if (findings.some((f) => f.severity === 'MEDIUM')) {
      return 'MEDIUM';
    }
    if (findings.some((f) => f.severity === 'LOW')) {
      return 'LOW';
    }
    return 'SAFE';
  }

  private generateSummary(riskLevel: RiskLevel, findingsCount: number): string {
    switch (riskLevel) {
      case 'CRITICAL':
        return 'Your project contains critical or blocking vulnerabilities that must be fixed immediately.';
      case 'HIGH':
        return 'Your project contains high-severity issues that should be resolved before deployment.';
      case 'MEDIUM':
        return 'Your project requires medium-priority fixes to prevent performance or security bottlenecks.';
      case 'LOW':
        return `Your project is overall stable and secure, with ${findingsCount} minor improvement(s) recommended.`;
      case 'SAFE':
      default:
        return 'Excellent! Your project is secure, stable, and ready for production.';
    }
  }
}