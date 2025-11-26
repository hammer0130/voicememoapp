// src/services/googleStt.ts
import speech from '@google-cloud/speech';
import fs from 'node:fs';

const client = new speech.SpeechClient();

export async function transcribeLocalFile(filePath: string): Promise<string> {
  // 1) 오디오 파일 읽어서 base64 인코딩
  const file = fs.readFileSync(filePath);
  const audio = {
    content: file.toString('base64'),
  };

  // 2) STT 설정
  const config = {
    // 브라우저 MediaRecorder 기본(WebM + Opus) 기준
    encoding: 'WEBM_OPUS' as const,
    sampleRateHertz: 48000,
    languageCode: 'ko-KR',
    enableAutomaticPunctuation: true, // 자동 문장부호
    // model: 'latest_long', // 길고 정확한 모델 쓰고 싶으면 (요금 조금 다를 수 있음)
  };

  const request = {
    audio,
    config,
  };

  // 3) STT 호출
  const [response] = await client.recognize(request);

  const transcription =
    response.results
      ?.map((r: any) => r.alternatives?.[0]?.transcript ?? '')
      .join('\n') ?? '';

  return transcription;
}
