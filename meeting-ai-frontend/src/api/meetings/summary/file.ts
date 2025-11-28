// frontend/api/meetings/summary/file.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { summarizeMeetingAudioBuffer } from '../../../lib/services/geminiClient';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  try {
    const { audioBase64, mimeType, originalName } = req.body as {
      audioBase64?: string;
      mimeType?: string;
      originalName?: string;
    };

    if (!audioBase64) {
      return res.status(400).json({
        ok: false,
        message:
          'audioBase64 필드가 필요합니다. (업로드한 파일을 base64로 인코딩해서 보내주세요)',
      });
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');

    const result = await summarizeMeetingAudioBuffer(audioBuffer, {
      source: 'upload',
      language: 'ko',
      mimeType: mimeType ?? 'audio/webm',
    });

    return res.status(200).json({
      ok: true,
      file: {
        originalName: originalName ?? null,
        mimeType: mimeType ?? null,
      },
      summary: result.rawText,
    });
  } catch (err: any) {
    console.error('[summary/file] error:', err);
    return res.status(500).json({
      ok: false,
      message: '오디오 요약 중 오류가 발생했습니다.',
      error: err?.message ?? String(err),
    });
  }
}
