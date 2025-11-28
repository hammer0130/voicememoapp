// frontend/api/meetings/analyze.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { transcribeAudioBuffer } from '../../lib/services/googleStt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  try {
    const { audioBase64, mimeType, languageCode } = req.body as {
      audioBase64?: string;
      mimeType?: string;
      languageCode?: string;
    };

    if (!audioBase64) {
      return res
        .status(400)
        .json({ ok: false, message: 'audioBase64 필드가 필요합니다.' });
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');

    const transcript = await transcribeAudioBuffer(audioBuffer, {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      languageCode: (languageCode as any) ?? 'ko-KR',
    });

    if (!transcript || !transcript.trim()) {
      return res.status(200).json({
        ok: false,
        message: 'STT 결과 텍스트가 비어 있습니다.',
        transcript,
      });
    }

    return res.status(200).json({
      ok: true,
      text: transcript,
      mimeType: mimeType ?? null,
    });
  } catch (err: any) {
    console.error('[STT] /api/meetings/analyze error:', err);
    return res.status(500).json({
      ok: false,
      message: 'STT 변환 중 오류가 발생했습니다.',
      error: err?.message ?? String(err),
    });
  }
}
