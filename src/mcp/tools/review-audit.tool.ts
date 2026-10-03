import { z } from "zod";
import { SYSTEM_AUDIT_PROMPT } from "../prompts/audit-review.prompt.js";

const sanitize = (s: string) =>
  s.replace(/(postgres|postgresql|mysql|mongodb(\+srv)?|redis):\/\/\S+/gi, "$1://***").slice(0, 150);

export const reviewAuditTool = {
  name: "review_audit",
  description: "Generates Executive Markdown Audit Report from deterministic AST findings. Evidence-First, no hallucination.",
  inputSchema: z.object({
    auditData: z.object({
      profile: z.record(z.string(), z.any()),
      findings: z.array(z.record(z.string(), z.any())),
      dashboardUrl: z.string().optional(),
      generatedAt: z.string().optional(),
    }).passthrough(),
  }),
  async handler({ auditData }: { auditData: { profile: Record<string, any>; findings: Array<Record<string, any>>; dashboardUrl?: string; generatedAt?: string } }) {
    const dashboardUrl = (auditData as any).dashboardUrl || "";

    const safeFindings = auditData.findings.map((f) => ({
      ...f,
      evidence: f.evidence ? sanitize(String(f.evidence)) : undefined,
    }));

    const safePayload = {
      profile: auditData.profile,
      findings: safeFindings,
      dashboardUrl,
      generatedAt: (auditData as any).generatedAt,
    };

    return {
      structuredContent: {
        systemPrompt: SYSTEM_AUDIT_PROMPT,
        llmConfig: {
          temperature: 0.1,
          maxTokens: 4000,
        },
        payload: safePayload,
        dashboardUrl,
        instruction: dashboardUrl
          ? `Pass systemPrompt + payload to LLM with temperature 0.1 to generate final markdown. MUST reference {id + file:line} for every fix. CRITICAL OUTPUT RULE: At the very end of the markdown, as the absolute LAST line after Prioritized Roadmap, append exactly: "📊 Dashboard: ${dashboardUrl}" - Do NOT print it at the beginning or in the middle.`
          : "Pass systemPrompt + payload to LLM with temperature 0.1 to generate final markdown. MUST reference {id + file:line} for every fix.",
      },
    };
  },
};