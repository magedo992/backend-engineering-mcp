import * as fs from 'node:fs';
import * as path from 'node:path';
import { ISecurityRule, SecurityContext } from '../interfaces/security-rule.interface.js';
import { AuditFinding } from '../../../types/audit.types.js';

export class EnvExposureRule implements ISecurityRule {
  id = 'SEC-ENV-001';
  name = 'Env Exposure Rule';

  check(ctx: SecurityContext): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const { profile, projectRoot } = ctx;

    if (profile.structure?.hasEnv) {
      const gitignorePath = path.join(projectRoot, '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf-8');
        if (!content.split(/\r?\n/).some(l => l.trim() === '.env' || l.trim() === '.env*')) {
          findings.push(this.create('SEC-ENV-001', 'CRITICAL', '.env file not ignored by .gitignore', '.env exists but not in .gitignore', '.gitignore', 'Add .env to .gitignore and rotate secrets'));
        }
      } else {
        findings.push(this.create('SEC-ENV-002', 'HIGH', 'Missing .gitignore with .env present', 'Project has .env but no .gitignore', undefined, 'Create .gitignore with .env'));
      }
    }

    if (profile.structure?.hasEnv && !profile.structure?.hasEnvExample) {
      findings.push(this.create('SEC-ENV-003', 'MEDIUM', '.env without .env.example', 'Env vars not documented', undefined, 'Create .env.example with dummy keys'));
    }
    return findings;
  }

  private create(id: string, severity: AuditFinding['severity'], title: string, message: string, file?: string, recommendation?: string): AuditFinding {
    return {
      id,
      source: 'security-analyzer',
      severity,
      category: 'SECURITY',
      title,
      message,
      ...(file ? { file } : {}),
      ...(recommendation ? { recommendation } : {}),
    };
  }
}