// src/routes/meetingRoutes.ts
import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { summarizeMeetingAudioFile, summarizeMeetingAudioBuffer, summarizeMeetingText } from '../lib/geminiClient';
import { transcribeLocalFile } from '../lib/googleStt';

const router = Router();

// 업로드 폴더 (없으면 알아서 만들면 더 좋지만, 일단 단순 버전)
const upload = multer({
  dest: path.join(__dirname, '../../uploads'),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB 제한 (20MB 넘으면 Files API로 바꾸는게 좋음) :contentReference[oaicite:2]{index=2}
  },
});

/**
 * 1) 이미 녹음된 음성 파일 업로드 → Gemini 요약
 *
 * POST /api/meetings/summary/file
 * form-data:
 *   file: (audio file)
 */
router.post(
  '/summary/file',
  upload.single('file'),
  async (req, res) => {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        ok: false,
        message: 'form-data 에 "file" 필드로 오디오 파일을 첨부해주세요.',
      });
    }

    try {
      const result = await summarizeMeetingAudioFile(file.path, {
        source: 'upload',
        language: 'ko',
      });

      // 응답 보내기
      res.json({
        ok: true,
        file: {
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
        },
        summary: result.rawText,
      });
    } catch (err: any) {
      console.error('[summary/file] error:', err);

      res.status(500).json({
        ok: false,
        message: '오디오 요약 중 오류가 발생했습니다.',
        error: err?.message ?? String(err),
      });
    } finally {
      // 임시 파일 삭제 (에러 여부와 상관없이)
      if (file?.path) {
        fs.unlink(file.path, () => {});
      }
    }
  },
);

// 2) 🔥 유튜브 탭: 파일 저장 없이 메모리(Buffer)로 처리
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

/**
 * POST /api/meetings/summary/youtube
 * form-data:
 *   file: (audio blob -> File)
 *   videoUrl?: string   // 선택: 사용자가 직접 입력한 유튜브 URL
 */
router.post(
  '/summary/youtube',
  memoryUpload.single('file'),
  async (req, res) => {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        ok: false,
        message: 'form-data 에 "file" 필드로 오디오 파일을 첨부해주세요.',
      });
    }

    const { videoUrl } = req.body as { videoUrl?: string };

    try {
      const result = await summarizeMeetingAudioBuffer(file.buffer, {
        source: 'youtube',
        language: 'ko',
        mimeType: file.mimetype,
      });

      res.json({
        ok: true,
        source: 'youtube',
        videoUrl: videoUrl ?? null,
        file: {
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
        },
        summary: result.rawText,
      });
    } catch (err: any) {
      console.error('[summary/youtube] error:', err);

      res.status(500).json({
        ok: false,
        message: '유튜브 탭 음성 요약 중 오류가 발생했습니다.',
        error: err?.message ?? String(err),
      });
    }
  },
);

router.post(
  '/analyze',
  upload.single('audio'), // audio 필드 1개
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'audio 파일이 필요합니다.' });
    }

    console.log('[STT] uploaded file:', {
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    });

    const filePath = req.file.path;

    try {
      const transcript = await transcribeLocalFile(filePath);

      console.log('[STT] transcript:', JSON.stringify(transcript).slice(0, 200));

      if (!transcript || !transcript.trim()) {
        // 에러로 던지지 말고 일단 응답으로 내려주게 바꿔도 됨
        return res.status(200).json({
          ok: false,
          message: 'STT 결과 텍스트가 비어 있습니다.',
          transcript,
        });
      }

      return res.json({ ok: true, text: transcript });
    } catch (err: any) {
      console.error('[STT] error:', err);
      return res.status(500).json({
        ok: false,
        message: 'STT 변환 중 오류가 발생했습니다.',
        error: err?.message,
      });
    } finally {
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error('파일 삭제 실패:', unlinkErr);
      });
    }
  },
);

export default router;
