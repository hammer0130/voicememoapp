
import dotenv from 'dotenv';
dotenv.config(); // 가장 먼저 env 로드

import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';

const apiKey = process.env.GEMINI_API_KEY;


if (!apiKey) {
  console.warn(
    '[Gemini] GEMINI_API_KEY 환경 변수가 설정되지 않았습니다. .env 를 확인해주세요.',
  );
}

const ai = new GoogleGenAI({
  apiKey,
});


// 단순 요약 결과 타입 (필요하면 나중에 더 구조화해도 됨)
export interface AudioSummaryResult {
  rawText: string; // 모델이 그대로 만들어준 요약 텍스트
}

/** 확장자 기준으로 대충 mime type 추론 */
function detectMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.mp3') return 'audio/mp3';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.m4a') return 'audio/mp4';
  if (ext === '.webm') return 'audio/webm';
  if (ext === '.ogg') return 'audio/ogg';

  // 모르면 일단 mpeg
  return 'audio/mpeg';
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

      // 재시도 조건: 모델 과부하/일시적 에러일 때만
      if (!isOverloaded || attempt === retries) {
        break;
      }

      const delay = baseDelayMs * Math.pow(2, attempt); // 지수 백오프
      console.warn(
        `[Gemini] overloaded, retrying (${attempt + 1}/${retries}) after ${delay}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ======================
// 공통 systemInstruction 빌더
// ======================
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

/**
 * 로컬 오디오 파일을 Gemini에 보내서 회의 요약 텍스트를 받아오는 함수
 */
export async function summarizeMeetingAudioFile(
  filePath: string,
  options?: { source?: 'upload' | 'youtube' | 'recording'; language?: 'ko' | 'en' },
): Promise<AudioSummaryResult> {
  const mimeType = detectMimeType(filePath);
  const base64Audio = fs.readFileSync(filePath, { encoding: 'base64' });

  const sourceLabel =
    options?.source === 'youtube'
      ? '유튜브에서 녹음한 음성'
      : options?.source === 'recording'
      ? '브라우저에서 직접 녹음한 음성'
      : '업로드한 음성 파일';

  const language = options?.language ?? 'ko';

  const systemInstruction =
    language === 'ko'
      ? [
          '당신은 회의록 요약 도우미입니다.',
          `${sourceLabel}을 듣고 회의 요약을 작성해주세요.`,
          '',
          '아래 형식을 지켜서 한국어로만 답변하세요.',
          '',
          '1. 회의 요약 (3~6 문장)',
          '2. 주요 논의 사항 (bullet list)',
          '3. 결정된 사항 (bullet list)',
          '4. 액션 아이템 (담당자 / 기한 포함, bullet list)',
        ].join('\n')
      : [
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

  // audio + 텍스트를 함께 보냄 :contentReference[oaicite:0]{index=0}
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
  // gemini-2.5-flash, gemini-2.0-flash
  const response = await withRetry(
    () =>
      ai.models.generateContent({
        model: 'gemini-2.0-flash',
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

// ==================================================
// 추가: Buffer 기반(파일 저장 없이) 오디오 요약 함수
// ==================================================
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
        model: 'gemini-2.0-flash',
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

// ==================================================
// 추가: STT(텍스트) 기반 회의 요약 함수
// ==================================================
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

  // STT로 변환된 "회의 전체 텍스트"를 하나의 user 메시지로 보냄
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
        model: 'gemini-2.0-flash',
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