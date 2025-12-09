// frontend/lib/server/geminiClient.ts
import { GoogleGenAI } from '@google/genai';

// Vercel 환경변수에서 API 키 읽기
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn(
    '[Gemini] GEMINI_API_KEY is not set. Please configure it in Vercel Environment Variables.',
  );
}

const ai = new GoogleGenAI({
  apiKey,
});

export interface AudioSummaryResult {
  rawText: string;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { retries?: number; baseDelayMs?: number },
): Promise<T> {
  const retries = options?.retries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;

  let lastError: any;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      const isOverloaded =
        err?.error?.error?.status === 'UNAVAILABLE' ||
        err?.error?.error?.code === 503 ||
        err?.message?.includes('overloaded');

      if (!isOverloaded || attempt === retries) break;

      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(
        `[Gemini] overloaded, retrying (${attempt + 1}/${retries}) after ${delay}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// 공통 systemInstruction 빌더
function buildSystemInstruction(
  sourceLabel: string,
  language: 'ko' | 'en' = 'ko',
): string {
  if (language === 'ko') {
    return [
      '당신은 회의록 요약 도우미입니다.',
      `${sourceLabel}을 듣고 회의 요약을 작성해주세요.`,
      '',
      '아래 형식을 지켜서 한국어로만 답변하세요.',
      '',
      '1. 회의 요약 (3~6 문장)',
      '2. 주요 논의 사항 (bullet list)',
      '3. 결정된 사항 (bullet list)',
      '4. 액션 아이템 (담당자 / 기한 포함, bullet list)',
    ].join('\n');
  }

  return [
    'You are a meeting summarization assistant.',
    `Listen to the ${sourceLabel} and write a concise meeting summary.`,
    '',
    'Please answer in English, with the following sections:',
    '',
    '1. Summary (3-6 sentences)',
    '2. Key discussion points (bullet list)',
    '3. Decisions (bullet list)',
    '4. Action items (with owner / due date, bullet list)',
  ].join('\n');
}

// ======================
// Buffer 기반 오디오 요약
// ======================
export async function summarizeMeetingAudioBuffer(
  audioBuffer: Buffer,
  options?: {
    source?: 'upload' | 'youtube' | 'recording';
    language?: 'ko' | 'en';
    mimeType?: string;
  },
): Promise<AudioSummaryResult> {
  const mimeType = options?.mimeType || 'audio/webm';

  const sourceLabel =
    options?.source === 'youtube'
      ? '유튜브에서 녹음한 음성'
      : options?.source === 'recording'
      ? '브라우저에서 직접 녹음한 음성'
      : '업로드한 음성 파일';

  const language = options?.language ?? 'ko';
  const systemInstruction = buildSystemInstruction(sourceLabel, language);

  const base64Audio = audioBuffer.toString('base64');

  const contents = [
    {
      role: 'user',
      parts: [
        { text: systemInstruction },
        {
          inlineData: {
            mimeType,
            data: base64Audio,
          },
        },
      ],
    },
  ];

  const response = await withRetry(
    () =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
      }),
    { retries: 3, baseDelayMs: 1000 },
  );

  const text = response.text ?? '';
  if (!text || !text.trim()) {
    throw new Error('Gemini 응답이 비어 있습니다.');
  }

  return {
    rawText: text.trim(),
  };
}

// ======================
// STT 텍스트 기반 요약
// ======================
export async function summarizeMeetingText(
  transcript: string,
  options?: {
    source?: 'stt' | 'upload' | 'youtube' | 'recording';
    language?: 'ko' | 'en';
  },
): Promise<AudioSummaryResult> {
  const language = options?.language ?? 'ko';

  const sourceLabel =
    options?.source === 'youtube'
      ? '유튜브에서 STT로 변환한 텍스트'
      : options?.source === 'recording'
      ? '브라우저에서 직접 녹음 후 STT로 변환한 텍스트'
      : options?.source === 'upload'
      ? '업로드한 음성 파일을 STT로 변환한 텍스트'
      : 'STT로 변환된 회의 텍스트';

  const systemInstruction = buildSystemInstruction(sourceLabel, language);

  const contents = [
    {
      role: 'user',
      parts: [
        { text: systemInstruction },
        {
          text:
            (language === 'ko'
              ? '\n\n[회의 전체 텍스트]\n'
              : '\n\n[Full meeting transcript]\n') + transcript,
        },
      ],
    },
  ];

  const response = await withRetry(
    () =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
      }),
    { retries: 3, baseDelayMs: 1000 },
  );

  const text = response.text ?? '';
  if (!text || !text.trim()) {
    throw new Error('Gemini 요약 응답이 비어 있습니다.');
  }

  return {
    rawText: text.trim(),
  };
}
