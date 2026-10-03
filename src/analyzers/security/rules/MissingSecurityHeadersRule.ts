import { ISecurityRule, SecurityContext } from '../interfaces/security-rule.interface.js';
import { AuditFinding } from '../../../types/audit.types.js';

export class MissingSecurityHeadersRule implements ISecurityRule {
  id = 'SEC-HDR-001';
  name = 'Missing Security Headers Rule';

  check(ctx: SecurityContext): AuditFinding[] {
    const entryFiles = ctx.files.filter(f => /(server|app|index|main)\.(ts|js)$/i.test(f.getFilePath()));
    if (entryFiles.length === 0) return [];

    const allText = entryFiles.map(f => f.getText()).join('\n');
    const hasHelmetImport = entryFiles.some(f =>
      f.getImportDeclarations().some(i => i.getModuleSpecifierValue().includes('helmet'))
    );
    const hasHelmetUse = /app\.use\s*\(\s*helmet/.test(allText);

    if (!hasHelmetImport || !hasHelmetUse) {
      return [{
        id: this.id,
        source: 'security-analyzer',
        severity: 'MEDIUM',
        category: 'SECURITY',
        title: 'Missing Security Headers Middleware (Helmet)',
        message: 'Helmet middleware not detected in entry files',
        evidence: `Checked: ${entryFiles.map(f => f.getBaseName()).join(', ')}`,
        recommendation: 'Install helmet and add app.use(helmet())',
      }];
    }
    return [];
  }
}