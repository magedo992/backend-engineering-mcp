#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { runFullAuditTool } from './mcp/tools/run-full-audit.tool.js';
import { getProjectProfileTool } from './mcp/tools/get-project-profile.tool.js';
import { reviewAuditTool } from './mcp/tools/review-audit.tool.js';
import { auditReviewPrompt } from './mcp/prompts/audit-review.prompt.js';

const server = new Server(
  {
    name: 'backend-auditor-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: runFullAuditTool.name,
        description: runFullAuditTool.description,
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Absolute file system path to project root',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: getProjectProfileTool.name,
        description: getProjectProfileTool.description,
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Absolute file system path to project root',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: reviewAuditTool.name,
        description: reviewAuditTool.description,
        inputSchema: {
          type: 'object',
          properties: {
            auditData: {
              type: 'object',
              properties: {
                profile: { type: 'object' },
                findings: { type: 'array', items: { type: 'object' } },
              },
              required: ['profile', 'findings'],
            },
          },
          required: ['auditData'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error(`Arguments are required for tool call: ${name}`);
  }

  switch (name) {
    case runFullAuditTool.name:
      return await runFullAuditTool.handler(args as { projectPath: string });

    case getProjectProfileTool.name:
      return await getProjectProfileTool.handler(args as { projectPath: string });

    case reviewAuditTool.name:
      return await reviewAuditTool.handler(
        args as { auditData: { profile: Record<string, any>; findings: Array<Record<string, any>> } },
      );

    default:
      throw new Error(`Tool not found: ${name}`);
  }
});

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: auditReviewPrompt.name,
        description: auditReviewPrompt.description,
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === auditReviewPrompt.name) {
    return await auditReviewPrompt.handler();
  }
  throw new Error(`Prompt not found: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Backend Auditor MCP Server is running on stdio...');
}

main().catch((error) => {
  console.error('Fatal error starting MCP server:', error);
  process.exit(1);
});