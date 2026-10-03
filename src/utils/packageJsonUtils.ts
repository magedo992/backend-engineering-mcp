import * as fs from 'node:fs';
import * as path from 'node:path';

export function getPackageJsonContent(input?: string | Record<string, unknown>): Record<string, any> {
  if (!input) return {};
  if (typeof input === 'object') return input;
  try {
    let filePath = input;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'package.json');
    }
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch {}
  return {};
}

export function getScripts(input?: string | Record<string, unknown>): Record<string, string> {
  const content = getPackageJsonContent(input);
  return content.scripts || {};
}

export function getDependencies(input?: string | Record<string, unknown>): Record<string, string> {
  const content = getPackageJsonContent(input);
  return {
    ...(content.dependencies || {}),
    ...(content.devDependencies || {}),
  };
}