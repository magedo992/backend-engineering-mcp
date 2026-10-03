import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFreePort } from '../utils/getFreePort.js';

export async function serveDashboard(auditData?: any, projectPath?: string): Promise<string> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  let publicDir = path.resolve(__dirname, '../../public');
  if (!fs.existsSync(publicDir)) {
    publicDir = path.resolve(process.cwd(), 'public');
  }

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  if (auditData) {
    fs.writeFileSync(path.join(publicDir, 'audit.json'), JSON.stringify(auditData, null, 2));
  }

  const port = await getFreePort(3000);
  
  const server = http.createServer((req, res) => {
    const cleanUrl = req.url?.split('?')[0] || '/';
    const reqPath = cleanUrl === '/' ? '/index.html' : cleanUrl;
    
    const filePath = path.join(publicDir, reqPath);
    
    if (!filePath.startsWith(publicDir)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let finalPath = filePath;
    if (!fs.existsSync(finalPath) || fs.statSync(finalPath).isDirectory()) {
      finalPath = path.join(publicDir, 'index.html');
    }
    
    if (!fs.existsSync(finalPath)) {
      res.writeHead(404).end('Dashboard not found - missing public/index.html');
      return;
    }
    
    const ext = path.extname(finalPath);
    const map: Record<string, string> = { 
      '.html': 'text/html', 
      '.json': 'application/json', 
      '.js': 'text/javascript',
      '.css': 'text/css' 
    };
    
    res.writeHead(200, { 'Content-Type': map[ext] || 'text/html' });
    fs.createReadStream(finalPath).pipe(res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  const url = `http://localhost:${port}`;
  return url;
}