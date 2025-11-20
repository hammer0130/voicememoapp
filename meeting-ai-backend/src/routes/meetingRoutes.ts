// src/routes/meetingRoutes.ts
import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { summarizeMeetingAudioFile, summarizeMeetingAudioBuffer } from '../lib/geminiClient';

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
 * 2) 유튜브 탭에서 바로 녹음한 음성 → Gemini 요약
 *
 * POST /api/meetings/summary/youtube
 * form-data:
 *   file: (audio blob -> File)
 *   videoUrl?: string   // 선택: 어떤 유튜브 영상인지
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
          // 디스크에 저장은 안 하지만, info 정도는 내려줘도 됨
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

export default router;
