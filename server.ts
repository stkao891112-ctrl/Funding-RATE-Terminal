import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 如果使用者有設定遠端 Python API 的 URL，則透過代理轉發
  // 這樣可以避免瀏覽器 CORS 問題
  const pythonApiUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:8080';

  console.log(`[Proxy] Target Python API: ${pythonApiUrl}`);

  // 設置 API 代理 - 採用最明確的轉發方式
  app.use('/api', createProxyMiddleware({
    target: pythonApiUrl,
    changeOrigin: true,
    // 關鍵：將「被 Express 截斷的路徑」補回 /api 前綴
    pathRewrite: (path, req) => {
      const newPath = '/api' + path;
      console.log(`[Proxy Path Rewrite] ${path} -> ${newPath}`);
      return newPath;
    },
    on: {
      proxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy request] ${req.method} ${req.url} -> ${pythonApiUrl}${proxyReq.path}`);
      },
      proxyRes: (proxyRes, req, res) => {
        console.log(`[Proxy response] Status: ${proxyRes.statusCode} from Python API`);
      },
      error: (err, req, res) => {
        console.error('[Proxy Error]', err);
        // 確保回傳 JSON 而不是 HTML，避免前端解析失敗
        if ('setHeader' in res && 'writeHead' in res) {
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(500);
          res.end(JSON.stringify({ 
            status: 'error', 
            message: 'Proxy connection failed', 
            details: err.message 
          }));
        }
      }
    }
  }));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
