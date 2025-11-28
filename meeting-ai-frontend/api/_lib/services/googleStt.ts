// frontend/lib/server/googleStt.ts
import * as speech from '@google-cloud/speech';

const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

const client =
  credentialsJson && credentialsJson.trim().length > 0
    ? new speech.SpeechClient({
        credentials: JSON.parse(credentialsJson),
      })
    : new speech.SpeechClient();

export async function transcribeAudioBuffer(
  audioBuffer: Buffer,
  options?: {
    languageCode?: string;
    encoding?:
      | 'WEBM_OPUS'
      | 'OGG_OPUS'
      | 'MP3'
      | 'LINEAR16'
      | 'FLAC'
      | 'MULAW'
      | 'ALAW';
    sampleRateHertz?: number;
  },
): Promise<string> {
  const languageCode = options?.languageCode ?? 'ko-KR';
  const encoding = options?.encoding ?? 'WEBM_OPUS';
  const sampleRateHertz = options?.sampleRateHertz ?? 48000;

  const audio = {
    content: audioBuffer.toString('base64'),
  };

  // 🔥 이제 이 타입 사용이 정상 동작해야 함
  const config: speech.protos.google.cloud.speech.v1.IRecognitionConfig = {
    languageCode,
    enableAutomaticPunctuation: true,
    encoding: encoding as any,
    sampleRateHertz,
  };

  const request: speech.protos.google.cloud.speech.v1.IRecognizeRequest = {
    audio,
    config,
  };

  console.log('[STT] sending recognize request...', audioBuffer.length);

  const [response] = await client.recognize(request);

  if (!response.results || response.results.length === 0) {
    console.warn('[STT] no results in response');
    return '';
  }

  const transcription =
    response.results
      ?.map((r) => r.alternatives?.[0]?.transcript ?? '')
      .join('\n') ?? '';

  console.log(
    '[STT] transcription (first 200 chars):',
    transcription.slice(0, 200),
  );

  return transcription;
}
