import * as path from 'node:path';
import { SyntaxKind, Node } from 'ts-morph';
import { ISecurityRule, SecurityContext } from '../interfaces/security-rule.interface.js';
import { AuditFinding } from '../../../types/audit.types.js';

export class HardcodedSecretsRule implements ISecurityRule {
  id = 'SEC-SECRET-001';
  name = 'Hardcoded Secrets Rule';
  private secretPattern = /(jwt.?secret|api.?key|password|passwd|secret|private.?key|token|auth)/i;

  check(ctx: SecurityContext): AuditFinding[] {
    const findings: AuditFinding[] = [];
    for (const file of ctx.files) {
      const relative = path.relative(ctx.projectRoot, file.getFilePath()).replace(/\\/g, '/');
      if (relative.includes('.env.example') || relative.includes('node_modules')) continue;

      // A. Variable Declarations: const jwtSecret = "hardcoded"
      for (const v of file.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
        const name = v.getName();
        const init = v.getInitializer();
        if (!init || !this.secretPattern.test(name)) continue;
        if (init.getText().includes('process.env')) continue;
        if (Node.isStringLiteral(init) || Node.isNoSubstitutionTemplateLiteral(init)) {
          if (init.getText().length > 4) { // Ignore empty strings ""
            findings.push(this.create(relative, v.getStartLineNumber(), `Variable '${name}' holds hardcoded secret`, this.sanitize(init.getText())));
          }
        }
      }

      // B. Object Property Assignments: { password: "123" }
      for (const p of file.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
        const name = p.getName();
        const init = p.getInitializer();
        if (!init || !this.secretPattern.test(name)) continue;
        if (init.getText().includes('process.env')) continue;
        if (Node.isStringLiteral(init) || Node.isNoSubstitutionTemplateLiteral(init)) {
          findings.push(this.create(relative, p.getStartLineNumber(), `Property '${name}' assigned hardcoded secret`, this.sanitize(init.getText())));
        }
      }
    }
    return findings;
  }

  private create(file: string, line: number, message: string, evidence: string): AuditFinding {
    return {
      id: this.id,
      source: 'security-analyzer',
      severity: 'CRITICAL',
      category: 'SECURITY',
      title: 'Potential hardcoded secret in source code',
      message,
      file,
      line,
      evidence,
      recommendation: 'Move secret to .env and use process.env.VAR_NAME',
    };
  }

  private sanitize(s: string): string {
    return s.slice(0, 120);
  }
}