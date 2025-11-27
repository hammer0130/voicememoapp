import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import meetingRoutes from './routes/meetingRoutes';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 8000;

// JSON 파싱 (필요시)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS – 프론트 주소로 수정하면 됨 (Vite면 보통 5173)
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://192.168.3.110:5173'
    ],
  }),
);

app.use('/api/meetings', meetingRoutes);

app.get('/', (_req, res) => {
  res.send('meeting-ai-backend is running');
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
