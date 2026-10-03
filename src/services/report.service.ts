import fs from 'node:fs/promises';
import path from 'node:path';

import {
  AuditFinding,
  AuditReport,
  AuditProjectInfo,
  SonarAnalysisResult,
} from '../types/audit.types.js';
import { ScoreService } from './score.service.js';

export class ReportService {
  private scoreService = new ScoreService();

  async generateReport(
    project: AuditProjectInfo,
    sonar: SonarAnalysisResult,
    outputDirectory: string,
  ): Promise<AuditReport> {
    const findings: AuditFinding[] = [...sonar.findings].sort(
      (a, b) =>
        this.scoreService.getSeverityWeight(b.severity) -
        this.scoreService.getSeverityWeight(a.severity),
    );

    const health = this.scoreService.calculate(findings);

    const report: AuditReport = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      score: health.score,
      riskLevel: health.riskLevel,
      healthSummary: health.healthSummary,
      project,
      summary: this.createSummary(findings),
      sonarqube: sonar,
      findings,
    };

    await this.writeReport(
      report,
      outputDirectory,
    );

    return report;
  }

  private createSummary(
    findings: AuditFinding[],
  ) {
    return {
      totalFindings: findings.length,
      blockers: this.count(
        findings,
        'BLOCKER',
      ),
      critical: this.count(
        findings,
        'CRITICAL',
      ),
      high: this.count(
        findings,
        'HIGH',
      ),
      medium: this.count(
        findings,
        'MEDIUM',
      ),
      low: this.count(
        findings,
        'LOW',
      ),
      info: this.count(
        findings,
        'INFO',
      ),
    };
  }

  private count(
    findings: AuditFinding[],
    severity: AuditFinding['severity'],
  ): number {
    return findings.filter(
      (finding) =>
        finding.severity === severity,
    ).length;
  }

  private async writeReport(
    report: AuditReport,
    outputDirectory: string,
  ): Promise<void> {
    await fs.mkdir(
      outputDirectory,
      {
        recursive: true,
      },
    );

    const jsonPath = path.join(
      outputDirectory,
      'audit.json',
    );

    const markdownPath = path.join(
      outputDirectory,
      'audit.md',
    );

    await fs.writeFile(
      jsonPath,
      JSON.stringify(report, null, 2),
      'utf-8',
    );

    await fs.writeFile(
      markdownPath,
      this.toMarkdown(report),
      'utf-8',
    );
  }

  private toMarkdown(
    report: AuditReport,
  ): string {
    const { summary } = report;

    const findings = report.findings
      .map(
        (finding, index) => `
### ${index + 1}. ${finding.title}

- **Source:** ${finding.source}
- **Severity:** ${finding.severity}
- **Category:** ${finding.category}
- **Rule:** ${finding.rule ?? 'N/A'}
- **File:** ${finding.file ?? 'N/A'}
- **Line:** ${finding.line ?? 'N/A'}

**Message**

${finding.message}

**Recommendation**

${finding.recommendation ?? 'No recommendation available.'}
`,
      )
      .join('\n');

    return `# Backend Audit Report

## Project

- **Name:** ${report.project.name}
- **Path:** ${report.project.path}
- **Generated:** ${report.generatedAt}

---

## Health & Risk Summary

- **Audit Score:** **${report.score}/100**
- **Risk Level:** **${report.riskLevel}**
- **Status:** ${report.healthSummary}

---

## Summary

| Severity | Count |
|---|---:|
| BLOCKER | ${summary.blockers} |
| CRITICAL | ${summary.critical} |
| HIGH | ${summary.high} |
| MEDIUM | ${summary.medium} |
| LOW | ${summary.low} |
| INFO | ${summary.info} |
| **TOTAL** | **${summary.totalFindings}** |

---

## SonarQube Metrics

| Metric | Value |
|---|---:|
| Bugs | ${report.sonarqube.metrics.bugs ?? 'N/A'} |
| Vulnerabilities | ${report.sonarqube.metrics.vulnerabilities ?? 'N/A'} |
| Code Smells | ${report.sonarqube.metrics.codeSmells ?? 'N/A'} |
| Security Hotspots | ${report.sonarqube.metrics.securityHotspots ?? 'N/A'} |
| Coverage | ${report.sonarqube.metrics.coverage ?? 'N/A'}% |
| Duplications | ${report.sonarqube.metrics.duplicatedLinesDensity ?? 'N/A'}% |
| Lines | ${report.sonarqube.metrics.lines ?? 'N/A'} |

---

## Findings

${findings}

---

## End of Report
`;
  }
}