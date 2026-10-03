import { z } from "zod";
import * as fs from "node:fs";
import { ProjectDetector } from "../../detection/project-detector.js";

export const getProjectProfileTool = {
  name: "get_project_profile",
  description: "Fast technical profile detection of a Node.js/TypeScript backend project.",
  inputSchema: z.object({
    projectPath: z.string().describe("Absolute file system path to project root"),
  }),
  async handler({ projectPath }: { projectPath: string }) {
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project path not found: ${projectPath}`);
    }
    const detector = new ProjectDetector(projectPath);
    const profile = await detector.detect();
    return {
      structuredContent: { profile },
    };
  },
};