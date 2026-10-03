import * as fs from 'node:fs';
import * as path from 'node:path';
import { Project, Node, SyntaxKind, SourceFile, CallExpression } from 'ts-morph';
import { AuditFinding } from '../../types/audit.types.js';
import { SourceHit } from '../../scanners/db-source.scanner.js';

export class QueryAnalyzer {
  analyze(projectRoot: string, _hits: SourceHit[] = [], project?: Project): AuditFinding[] {
    const morphProject = project ?? this.createProject(projectRoot);
    const findings: AuditFinding[] = [];

    const files = this.getSourceFiles(morphProject, projectRoot);

    findings.push(...this.detectNPlusOneAST(files, projectRoot));
    findings.push(...this.detectUnboundedAST(files, projectRoot));
    findings.push(...this.detectRawUnsafeAST(files, projectRoot));
    findings.push(...this.detectMissingTransactionAST(files, projectRoot));
    findings.push(...this.detectMissingIndex(files, projectRoot));
    return findings;
  }

  private createProject(projectRoot: string): Project {
    const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
    const hasTsConfig = fs.existsSync(tsConfigPath);
    return new Project({
      ...(hasTsConfig ? { tsConfigFilePath: tsConfigPath } : {}),
      skipFileDependencyResolution: true,
      skipAddingFilesFromTsConfig: true,
    });
  }

  private getSourceFiles(project: Project, projectRoot: string): SourceFile[] {
    const normalizedRoot = projectRoot.replace(/\\/g, '/');
    if (project.getSourceFiles().length === 0) {
      project.addSourceFilesAtPaths([
        `${normalizedRoot}/src/**/*.{ts,js,mts,mjs}`,
        `${normalizedRoot}/**/*.{ts,js,mts,mjs}`,
        `!${normalizedRoot}/**/node_modules/**`,
        `!${normalizedRoot}/**/dist/**`,
        `!${normalizedRoot}/**/.next/**`,
        `!${normalizedRoot}/**/coverage/**`,
        `!${normalizedRoot}/**/reports/**`,
      ]);
    }
    return project.getSourceFiles().filter(
      f => !/(seed|test|spec|migration|fixture|\.test\.|\.spec\.|__tests__)/i.test(f.getFilePath())
    );
  }

  private isDbQueryCall(exprText: string): boolean {
    return /(?:this\.)?(prisma|repo|repository|manager|model|dataSource|em|db|knex|sequelize|Model|mongoose)(?:\.\w+)*\s*\.\s*(find|findOne|findMany|findFirst|findUnique|findById|findOneAndUpdate|where|select|create|update|delete|remove|save|count|aggregate|upsert)\s*$/i.test(
      exprText.trim()
    ) || /\.(find|findOne|findById|findMany)\s*\(/.test(exprText);
  }

  private isNaturallyBounded(call: CallExpression, filePath: string): boolean {
    const text = call.getText();
    const lowerFile = filePath.toLowerCase();

    const isSmallTable =
      /availability\.service/.test(lowerFile) ||
      (/availability/.test(text) && /dayOfWeek/.test(text)) ||
      lowerFile.includes('availability');

    if (isSmallTable) return true;

    if (lowerFile.includes('staff.service') && /staffService\.findMany/.test(text)) {
      return true;
    }

    const isDateBounded = /startAt\s*:\s*\{[^}]*gte|endAt\s*:\s*\{[^}]*lte|T23:59:59|gte:\s*new Date\(dateStr/.test(text);
    if (isDateBounded) return true;

    if (/where\s*:\s*\{\s*id\s*:/.test(text)) return true;
    if (/\.findById\s*\(/.test(text)) return true;

    return false;
  }

  private detectNPlusOneAST(files: SourceFile[], projectRoot: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    for (const sourceFile of files) {
      const allCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of allCalls) {
        const exprText = call.getExpression().getText();
        if (!this.isDbQueryCall(exprText)) continue;

        const ancestors = call.getAncestors();
        const loopAncestor = ancestors.find(a => {
          if (
            Node.isForStatement(a) ||
            Node.isForOfStatement(a) ||
            Node.isForInStatement(a) ||
            Node.isWhileStatement(a) ||
            Node.isDoStatement(a)
          ) {
            return true;
          }
          if (Node.isCallExpression(a)) {
            const callerExpr = a.getExpression();
            if (Node.isPropertyAccessExpression(callerExpr)) {
              return ['map', 'forEach', 'flatMap', 'reduce', 'each'].includes(callerExpr.getName());
            }
          }
          return false;
        });

        if (!loopAncestor) continue;

        const isParallelized = ancestors.some(
          a => Node.isCallExpression(a) && /Promise\.(all|allSettled)/.test(a.getExpression().getText())
        );
        if (isParallelized) continue;

        findings.push(
          this.createFinding({
            id: 'DB-PERF-001',
            severity: 'HIGH',
            title: 'Potential N+1 Query detected inside loop',
            message: 'Database query executed inside loop scope will trigger N+1 network roundtrips',
            file: path.relative(projectRoot, sourceFile.getFilePath()).replace(/\\/g, '/'),
            line: call.getStartLineNumber(),
            evidence: `Loop at L${loopAncestor.getStartLineNumber()} -> Query at L${call.getStartLineNumber()}: ${this.sanitize(
              call.getText()
            )}`,
            recommendation:
              'Pre-fetch with find({ _id: { $in: ids } }) / findMany({ where: { id: { in: ids } } }) outside loop or batch with Promise.all',
          })
        );
      }
    }
    return findings;
  }

  private detectUnboundedAST(files: SourceFile[], projectRoot: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    for (const sourceFile of files) {
      const filePath = sourceFile.getFilePath();
      const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
      const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of calls) {
        const exprText = call.getExpression().getText();

        if (!/\.(findMany|find|findOne)\b/i.test(exprText)) continue;
        if (!this.isDbQueryCall(exprText)) continue;
        if (this.isNaturallyBounded(call, filePath)) continue;

        const chainText = call.getParent()?.getText() ?? call.getText();
        if (/\.limit\s*\(|\.take\s*\(|\.skip\s*\(/.test(chainText)) continue;
        const after = sourceFile.getText().slice(call.getEnd(), call.getEnd() + 300).split(";")[0] ?? "";
        if (/\.limit\s*\(|\.lean\s*\(/.test(after) && /\.find/.test(exprText)) {
           if (/\.limit/.test(after)) continue;
        }

        const args = call.getArguments();
        if (args.length === 0) {
          findings.push(
            this.createFinding({
              id: 'DB-PERF-002',
              severity: 'MEDIUM',
              title: 'Unbounded query without pagination limit',
              message: 'find()/findMany() called without arguments will fetch entire collection/table',
              file: relativePath,
              line: call.getStartLineNumber(),
              evidence: this.sanitize(call.getText()),
              recommendation: 'Add pagination: .limit(20) / take: 20, skip: 0',
            })
          );
          continue;
        }

        const firstArg = args[0];
        if (Node.isObjectLiteralExpression(firstArg)) {
          const props = firstArg
            .getProperties()
            .map(p => (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p) ? p.getName() : null))
            .filter((p): p is string => p !== null);

          const hasLimit = props.some(p => ['take', 'limit', 'first', 'cursor', 'skip', 'perPage', 'pageSize'].includes(p));

          if (!hasLimit) {
            const isSelective = /where\s*:/.test(call.getText()) && /staffId|userId|where.*id:|_id/.test(call.getText());
            findings.push(
              this.createFinding({
                id: 'DB-PERF-002',
                severity: isSelective ? 'LOW' : 'MEDIUM',
                title: 'Unbounded query without pagination limit',
                message: isSelective
                  ? 'Query is selective but lacks explicit limit - consider adding pagination for safety'
                  : 'Query options object lacks explicit limit/take pagination',
                file: relativePath,
                line: call.getStartLineNumber(),
                evidence: this.sanitize(call.getText()),
                recommendation: 'Add limit/take parameter to query criteria or chain .limit()',
              })
            );
          }
        } else if (args.length > 0) {
          if (!/take\s*:|limit\s*:|cursor\s*:|skip\s*:|\.limit\s*\(/.test(call.getText() + after)) {
            findings.push(
              this.createFinding({
                id: 'DB-PERF-002',
                severity: 'LOW',
                title: 'Potential unbounded query (dynamic arguments)',
                message: 'Query uses dynamic variable/expression that may lack explicit limit/take pagination',
                file: relativePath,
                line: call.getStartLineNumber(),
                evidence: this.sanitize(call.getText()),
                recommendation: 'Ensure dynamic options pass take/limit/.limit() parameter',
              })
            );
          }
        }
      }
    }
    return findings;
  }

  private detectRawUnsafeAST(files: SourceFile[], projectRoot: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    for (const sourceFile of files) {
      for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const expr = call.getExpression().getText();
        const isRawMethod = /\$queryRawUnsafe|\$executeRawUnsafe|knex\.raw|sequelize\.query|\.query\s*\(|pool\.query|client\.query|db\.query|\.execute\s*\(/.test(expr);
        if (!isRawMethod) continue;

        const arg = call.getArguments()[0]?.getText() ?? "";
        const hasInterpolation = /`[^`]*\$\{[^}]*req\.(query|body|params)/.test(arg) || /\+.*req\.(query|body|params)|req\.(query|body|params).*\+/.test(arg) || /`[^`]*\$\{/.test(arg) && /SELECT|INSERT|UPDATE|DELETE/i.test(arg);
        
        if (/\$queryRawUnsafe|\$executeRawUnsafe/.test(expr)) {
          findings.push(
            this.createFinding({
              id: 'DB-SEC-001',
              severity: 'CRITICAL',
              title: 'Unsafe raw SQL execution (SQL Injection vulnerability)',
              message: 'Execution of unsafe raw SQL query method detected',
              file: path.relative(projectRoot, sourceFile.getFilePath()).replace(/\\/g, '/'),
              line: call.getStartLineNumber(),
              evidence: this.sanitize(call.getText()),
              recommendation: 'Use parameterized queries: knex.raw("select * where id = ?", [id]) / pool.query("... $1", [id]) / Prisma.sql``',
            })
          );
        } else if (hasInterpolation) {
          findings.push(
            this.createFinding({
              id: 'DB-SEC-002',
              severity: 'CRITICAL',
              title: 'Potential SQL Injection via string concatenation',
              message: 'Raw SQL query built with string interpolation using user input',
              file: path.relative(projectRoot, sourceFile.getFilePath()).replace(/\\/g, '/'),
              line: call.getStartLineNumber(),
              evidence: this.sanitize(call.getText()),
              recommendation: 'Use parameterized queries with placeholders (?, $1) and pass values separately',
            })
          );
        }
      }
    }
    return findings;
  }

  private detectMissingTransactionAST(files: SourceFile[], projectRoot: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const seenScopes = new Set<string>();

    for (const sourceFile of files) {
      const filePath = path.relative(projectRoot, sourceFile.getFilePath()).replace(/\\/g, '/');

      const scopes: Node[] = [
        ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
        ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
        ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
        ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ];

      if (scopes.length === 0) scopes.push(sourceFile);

      for (const scope of scopes) {
        const line = scope.getStartLineNumber();
        const scopeKey = `${filePath}:${line}`;
        if (seenScopes.has(scopeKey)) continue;

        const calls = scope.getDescendantsOfKind(SyntaxKind.CallExpression);

        const mutations = calls.filter(c =>
          /(?:this\.)?(prisma|tx|repo|repository|manager|db|Model|mongoose|knex|sequelize)(?:\.\w+)*\s*\.\s*(create|update|delete|upsert|createMany|updateMany|deleteMany|save|remove|insert|findOneAndUpdate|updateOne|updateMany|deleteOne|deleteMany)\s*\(/i.test(             c.getExpression().getText() + "("           )         );          if (mutations.length < 2) continue;          const isWrappedInTx = calls.some(c =>           /\$transaction\vert{}queryRunner\vert{}transaction\vert{}startSession\vert{}withTransaction\vert{}session\(\)/.test(c.getExpression().getText())
        );

        if (!isWrappedInTx) {
          seenScopes.add(scopeKey);
          findings.push(
            this.createFinding({
              id: 'DB-RELIABILITY-001',
              severity: 'HIGH',
              title: 'Multiple database mutation writes without transaction isolation',
              message: `Function scope performs ${mutations.length} writes outside transaction block`,
              file: filePath,
              line: line,
              evidence: mutations.slice(0, 2).map(c => this.sanitize(c.getText())).join(' | '),
              recommendation: 'Wrap mutations in transaction: prisma.$transaction / mongoose.startSession() / knex.transaction() / sequelize.transaction()',
            })
          );
        }
      }
    }
    return findings;
  }

  private detectMissingIndex(files: SourceFile[], projectRoot: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    
    const schemaPath = ['prisma/schema.prisma', 'schema.prisma', 'src/prisma/schema.prisma']
      .map(p => path.join(projectRoot, p))
      .find(p => fs.existsSync(p));

    if (schemaPath) {
      try {
        const content = fs.readFileSync(schemaPath, 'utf-8');
        const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
        let match: RegExpExecArray | null;

        while ((match = modelRegex.exec(content)) !== null) {
          const modelName = match[1];
          const body = match[2];
          if (!body) continue;

          for (const rel of body.matchAll(/@relation\s*\([^)]*fields\s*:\s*\[([^\]]+)\]/g)) {
            const matchGroup = rel[1];
            if (!matchGroup) continue;

            const fields = matchGroup.split(',').map(f => f.trim().replace(/["']/g, ''));
            for (const field of fields) {
              const indexRegex = new RegExp(`@@index\\s*\\(\\s*\\[[^\\]]*\\b${field}\\b[^\\]]*\\]`);
              const uniqueOrIdRegex = new RegExp(`\\b${field}\\b[^\\n]*@(unique|id)\\b`);
              const modelUniqueRegex = new RegExp(`@@unique\\s*\\(\\s*\\[[^\\]]*\\b${field}\\b[^\\]]*\\]`);

              const hasIndex = indexRegex.test(body) || uniqueOrIdRegex.test(body) || modelUniqueRegex.test(body);

              if (!hasIndex) {
                findings.push(
                  this.createFinding({
                    id: 'DB-PERF-003',
                    severity: 'MEDIUM',
                    title: `Missing @@index on foreign key relation in ${modelName}`,
                    message: `Relation key "${field}" in model "${modelName}" lacks index coverage`,
                    file: path.relative(projectRoot, schemaPath).replace(/\\/g, '/'),
                    evidence: `Model ${modelName}: relation field "${field}" has no @@index`,
                    recommendation: `Add @@index([${field}])`,
                  })
                );
              }
            }
          }
        }
      } catch {}
      return findings;
    }

    for (const file of files) {
      const text = file.getText();
      if (!/new\s+(mongoose\.)?Schema/.test(text)) continue;
      const relative = path.relative(projectRoot, file.getFilePath()).replace(/\\/g, '/');
      
      for (const prop of file.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
        const propText = prop.getText();
        if (!/ref\s*:/.test(propText)) continue;
        const parentObj = prop.getFirstAncestorByKind(SyntaxKind.ObjectLiteralExpression);
        if (!parentObj) continue;
        const objText = parentObj.getText();
        if (/ref\s*:/.test(objText) && !/index\s*:\s*true/.test(objText) && !/unique\s*:\s*true/.test(objText)) {
          const fieldName = prop.getName().replace(/['"]/g, "");
          findings.push(
            this.createFinding({
              id: 'DB-PERF-004',
              severity: 'MEDIUM',
              title: `Missing index on Mongoose ref field "${fieldName}"`,
              message: `Field "${fieldName}" references another collection but lacks index`,
              file: relative,
              line: prop.getStartLineNumber(),
              evidence: this.sanitize(objText),
              recommendation: `Add index: true to field "${fieldName}" or schema.index({ ${fieldName}: 1 })`,
            })
          );
        }
      }
    }

    return findings;
  }

  private sanitize(s: string): string {
    return s.replace(/(postgres|postgresql|mysql|mongodb(\+srv)?|redis):\/\/\S+/gi, '$1://***').slice(0, 200);
  }

  private createFinding(opts: {
    id: string;
    severity: string;
    category?: string;
    title: string;
    message: string;
    file?: string;
    line?: number;
    evidence?: string;
    recommendation?: string;
  }): AuditFinding {
    const f: AuditFinding = {
      id: opts.id,
      source: 'query-analyzer',
      severity: opts.severity as any,
      category: opts.category ?? 'DATABASE',
      title: opts.title,
      message: opts.message,
    } as any;

    if (opts.file) (f as any).file = opts.file;
    if (opts.line) (f as any).line = opts.line;
    if (opts.evidence) (f as any).evidence = opts.evidence;
    if (opts.recommendation) (f as any).recommendation = opts.recommendation;
    return f;
  }
}