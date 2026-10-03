import * as path from "node:path";
import { SourceFile, SyntaxKind, Node, CallExpression } from "ts-morph";
import { ProjectProfile, DatabaseEngine } from "../../types/project.types.js";
import { AuditFinding } from "../../types/audit.types.js";

export class MongooseAnalyzer {
  analyze(profile: ProjectProfile, files: SourceFile[], projectRoot: string): AuditFinding[] {
    const isMongo = profile.databases?.some(d => d.value === DatabaseEngine.MongoDB) 
                 || profile.database?.value === DatabaseEngine.MongoDB
                 || profile.orm?.value === "Mongoose";

    if (!isMongo) return [];

    const findings: AuditFinding[] = [];
    const filtered = files.filter(f => !/(seed|test|spec|migration|\.test\.)/i.test(f.getFilePath()));

    findings.push(...this.checkNoSqlInjection(filtered, projectRoot));
    findings.push(...this.checkLean(filtered, projectRoot));
    findings.push(...this.checkStrictMode(filtered, projectRoot));

    return findings;
  }

  private checkNoSqlInjection(files: SourceFile[], projectRoot: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    for (const file of files) {
      const relative = path.relative(projectRoot, file.getFilePath()).replace(/\\/g, "/");
      
      for (const prop of file.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
        const name = prop.getName().replace(/['"]/g, "");
        if (name === "$where") {
          findings.push(this.create({
            id: "MONGO-SEC-001",
            severity: "CRITICAL",
            category: "SECURITY",
            title: "Potential NoSQL Injection via $where",
            message: "Usage of $where executes JavaScript inside MongoDB",
            file: relative,
            line: prop.getStartLineNumber(),
            evidence: this.sanitize(prop.getText()),
            recommendation: "Avoid $where completely, use typed query builders"
          }));
        }
        
        if (name === "$regex" && !prop.getText().includes("escapeRegExp")) {
           const initText = prop.getInitializer()?.getText() ?? "";
           if (/\breq\.(query|body|params)\b/.test(file.getText()) && initText.includes("req.")) {
            findings.push(this.create({
              id: "MONGO-SEC-002",
              severity: "HIGH",
              category: "SECURITY",
              title: "Unescaped $regex with user input",
              message: "$regex uses raw user input without escaping",
              file: relative,
              line: prop.getStartLineNumber(),
              evidence: this.sanitize(prop.getText()),
              recommendation: "Escape user input: new RegExp(escapeRegExp(input))"
            }));
           }
        }
      }
    }
    return findings;
  }

  private checkLean(files: SourceFile[], projectRoot: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    for (const file of files) {
      const relative = path.relative(projectRoot, file.getFilePath()).replace(/\\/g, "/");
      for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const expr = call.getExpression().getText();
        if (!/(?:\.find|\.findOne|\.findById)(?:\b|\(|$)/.test(expr)) continue;
        if (this.isMongooseQuery(call)) {
          let hasLean = false;
          let parent: Node | undefined = call.getParent();
          for(let i=0; i<4 && parent; i++) {
            if (parent.getText().includes(".lean()")) { hasLean = true; break; }
            parent = parent.getParent();
          }
          if (file.getText().slice(call.getStart(), call.getStart()+500).includes(".lean()")) hasLean = true;

          if (!hasLean) {
            findings.push(this.create({
              id: "MONGO-PERF-001",
              severity: "MEDIUM",
              category: "DATABASE",
              title: "Mongoose read query without .lean()",
              message: "Read query hydrates full Mongoose documents unnecessarily",
              file: relative,
              line: call.getStartLineNumber(),
              evidence: this.sanitize(call.getText()),
              recommendation: "Append .lean() for read-only queries: Model.find().lean()"
            }));
          }
        }
      }
    }
    return findings;
  }

  private checkStrictMode(files: SourceFile[], projectRoot: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    for (const file of files) {
      const relative = path.relative(projectRoot, file.getFilePath()).replace(/\\/g, "/");
      for (const obj of file.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
        const text = obj.getText();
        if (!/strict\s*:\s*false/.test(text)) continue;
        const parent = obj.getParent()?.getText() ?? "";
        if (/new\s+(mongoose\.)?Schema/.test(parent) || /Schema\(/.test(parent)) {
          findings.push(this.create({
            id: "MONGO-SEC-003",
            severity: "HIGH",
            category: "DATABASE",
            title: "Mongoose strict mode disabled",
            message: "strict: false allows unvalidated fields to be saved",
            file: relative,
            line: obj.getStartLineNumber(),
            evidence: this.sanitize(text),
            recommendation: "Remove strict: false or set strict: 'throw'"
          }));
        }
      }
    }
    return findings;
  }

  private isMongooseQuery(call: CallExpression): boolean {
    const text = call.getExpression().getText();
    return /Model|Schema|mongoose|\.find/.test(text);
  }

  private sanitize(s: string){ return s.slice(0, 150); }

  private create(opts: any): AuditFinding {
    return {
      id: opts.id,
      source: "mongoose-analyzer",
      severity: opts.severity,
      category: opts.category,
      title: opts.title,
      message: opts.message,
      ...(opts.file ? { file: opts.file } : {}),
      ...(opts.line ? { line: opts.line } : {}),
      ...(opts.evidence ? { evidence: opts.evidence } : {}),
      ...(opts.recommendation ? { recommendation: opts.recommendation } : {}),
    };
  }
}
export const SqlAndNoSqlAnalyzer = MongooseAnalyzer;