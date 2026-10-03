import * as path from 'node:path';
import { SyntaxKind } from 'ts-morph';
import { ISecurityRule, SecurityContext } from '../interfaces/security-rule.interface.js';
import { AuditFinding } from '../../../types/audit.types.js';

export class SqlInjectionRule implements ISecurityRule {
  id = 'SEC-SQLI-001';
  name = 'SQL Injection Rule';

  check(ctx: SecurityContext): AuditFinding[] {
    const findings: AuditFinding[] = [];
    for (const file of ctx.files) {
      const relative = path.relative(ctx.projectRoot, file.getFilePath()).replace(/\\/g, '/');

      for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const text = call.getExpression().getText();

        // 1. Unsafe raw execution in ORMs/Query Builders ($queryRawUnsafe / $executeRawUnsafe)
        if (/\$queryRawUnsafe|\$executeRawUnsafe/.test(text)) {
          findings.push({
            id: this.id,
            source: 'security-analyzer',
            severity: 'CRITICAL',
            category: 'SECURITY',
            title: 'Unsafe raw SQL execution (SQL Injection)',
            message: 'Use of $queryRawUnsafe bypasses parameterization',
            file: relative,
            line: call.getStartLineNumber(),
            evidence: this.sanitize(call.getText()),
            recommendation: 'Use $queryRaw with Prisma.sql tag',
          });
        }

        // 2. String concatenation inside raw queries
        if (/\.query\(/.test(text) && call.getText().includes('+')) {
          if (/SELECT|INSERT|UPDATE|DELETE/i.test(call.getText())) {
            findings.push({
              id: 'SEC-SQLI-002',
              source: 'security-analyzer',
              severity: 'HIGH',
              category: 'SECURITY',
              title: 'Potential SQL Injection via string concatenation',
              message: 'SQL query built with + operator',
              file: relative,
              line: call.getStartLineNumber(),
              evidence: this.sanitize(call.getText()),
              recommendation: 'Use parameterized queries ($1, $2) or query builder',
            });
          }
        }
      }
    }
    return findings;
  }

  private sanitize(s: string): string {
    return s.replace(/(postgres|mysql):\/\/\S+/gi, '$1://***').slice(0, 150);
  }
}