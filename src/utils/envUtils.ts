// src/utils/envUtils.ts
import * as fs from 'fs/promises';
import * as path from 'path';

export async function readEnvFile(filePath: string): Promise<Record<string, string> | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return parseEnvFile(content);
  } catch (error) {
    return null;
  }
}

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  content.split('\n').forEach(line => {
    const [key, value] = line.trim().split('=');
    if (key && value) {
      result[key] = value;
    }
  });
  return result;
}