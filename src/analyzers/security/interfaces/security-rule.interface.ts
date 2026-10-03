import { SourceFile } from 'ts-morph';
import { ProjectProfile } from '../../../types/project.types.js';
import { AuditFinding } from '../../../types/audit.types.js';

export interface SecurityContext {
  files: SourceFile[];
  profile: ProjectProfile;
  projectRoot: string;
}

export interface ISecurityRule {
  id: string;
  name: string;
  check(ctx: SecurityContext): AuditFinding[];
}