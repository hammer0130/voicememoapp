// api/server.ts
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import handler from './meetings/summary/file.js';
import youtubeHandler from './meetings/summary/youtube.js';
import analyzeHandler from './meetings/analyze.js';

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '50mb' }));

// Express wrapper to convert Vercel handlers to Express middleware
const wrapVercelHandler = (vercelHandler: any) => {
  return async (req: Request, res: Response) => {
    // Convert Express req/res to Vercel-compatible format
    const vercelReq = req as any;
    const vercelRes = res as any;
    await vercelHandler(vercelReq, vercelRes);
  };
};

// 실제 라우트 연결
app.post('/api/meetings/summary/file', wrapVercelHandler(handler));
app.post('/api/meetings/summary/youtube', wrapVercelHandler(youtubeHandler));
app.post('/api/meetings/analyze', wrapVercelHandler(analyzeHandler));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
