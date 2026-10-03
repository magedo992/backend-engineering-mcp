import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import { ProjectDetector } from "../../detection/project-detector.js";
import { AuditOrchestrator } from "../../orchestrator/audit-orchestrator.js";
import { serveDashboard } from "../../server/dashboard-server.js";

export const runFullAuditTool = {
  name: "run_full_audit",
  description: "Executes full AST-based backend engineering audit covering DB, Security, and Architecture.",
  inputSchema: z.object({
    projectPath: z.string().describe("Absolute file system path to project root"),
  }),
  async handler({ projectPath }: { projectPath: string }) {
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project path not found: ${projectPath}`);
    }
    const detector = new ProjectDetector(projectPath);
    const profile = await detector.detect();

    const orchestrator = new AuditOrchestrator();
    const findings = orchestrator.runFullAudit(profile, projectPath);

    const auditData = { profile, findings, generatedAt: new Date().toISOString() };

    try {
      const publicDir = path.join(process.cwd(), "public");
      fs.mkdirSync(publicDir, { recursive: true });
      fs.writeFileSync(path.join(publicDir, "audit.json"), JSON.stringify(auditData, null, 2), "utf-8");

      const projectReportDir = path.join(projectPath, "reports", "latest");
      fs.mkdirSync(projectReportDir, { recursive: true });
      fs.writeFileSync(path.join(projectReportDir, "audit.json"), JSON.stringify(auditData, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to write audit.json:", e);
    }

    const count = (s: string) => findings.filter((f: any) => s === 'HIGH' ? ['HIGH','CRITICAL','BLOCKER'].includes(f.severity) : f.severity === s).length;
    const high = count('HIGH');
    const medium = count('MEDIUM');
    const low = count('LOW');
    const health = Math.max(0, 100 - (high * 20 + medium * 10 + low * 3));
    const projectName = path.basename(projectPath);

    const header = `🔍 ${projectName} — Health:${health}% | ${findings.length} findings (${high} HIGH, ${medium} MEDIUM,${low} LOW)`;
    const line = `┌──────────────────┬──────────┬────────────────────────────────────────┐`;
    const headRow = `│ ID               │ Severity │ Title                                  │`;
    const sep = `├──────────────────┼──────────┼────────────────────────────────────────┤`;
    const footer = `└──────────────────┴──────────┴────────────────────────────────────────┘`;

    const rows = findings.slice(0, 5).map((f: any) => {
      const id = (f.id || '-').padEnd(16);
      const sev = (f.severity || '').padEnd(8);
      const title = f.title.slice(0, 38).padEnd(38);
      return `│ ${id} │ ${sev} │${title} │`;
    }).join('\n');

    const more = findings.length > 5 ? `... و ${findings.length - 5} اخرين - شوفهم في الداشبورد` : ``;

    const findingsTable = [
      header,
      line, headRow, sep,
      rows || `│ (no findings)`.padEnd(62) + ` │`,
      footer,
      more,
      `✅ Audit complete: ${findings.length} findings`,
      `📁 Report: ${path.join(projectPath, "reports/latest/audit.json")}`,
    ].filter(Boolean).join('\n');

    let dashboardUrl = "";
    try {
      dashboardUrl = await serveDashboard(auditData, projectPath);
    } catch (e) {
      dashboardUrl = "";
    }

    try {
      const finalAuditData = { ...auditData, dashboardUrl } as any;
      fs.writeFileSync(path.join(process.cwd(), "public", "audit.json"), JSON.stringify(finalAuditData, null, 2), "utf-8");
      fs.writeFileSync(path.join(projectPath, "reports", "latest", "audit.json"), JSON.stringify(finalAuditData, null, 2), "utf-8");
    } catch {}

    console.error('\n' + findingsTable + '\n');

    return {
      content: [{ type: "text", text: findingsTable }],
      structuredContent: { profile, findings, total: findings.length, dashboardUrl, health },
    };
  },
};