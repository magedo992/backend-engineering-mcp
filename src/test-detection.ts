import * as fs from 'node:fs';
import { ProjectDetector } from './detection/project-detector.js';
import { AuditOrchestrator } from './orchestrator/audit-orchestrator.js';

const TARGET = 'C:/Users/ahmed/OneDrive/Desktop/booking api';

async function run() {
  const detector = new ProjectDetector(TARGET);
  const profile = await detector.detect();

  const orchestrator = new AuditOrchestrator();
  const findings = orchestrator.runFullAudit(profile, TARGET);

  console.log(`\n--- Audit Complete ---`);
  console.log(`Total Findings Identified: ${findings.length}`);
  console.log(`Findings Breakdown:`, findings.map(f => `[${f.severity}] ${f.id} - ${f.title}`));

  fs.writeFileSync(
    './audit-result.json',
    JSON.stringify({ profile, findings }, null, 2),
    'utf-8'
  );

  console.log(`\n Saved complete unified audit report to audit-result.json`);
}

run().catch(console.error);