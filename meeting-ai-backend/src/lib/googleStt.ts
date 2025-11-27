// src/services/googleStt.ts
import speech from '@google-cloud/speech';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const client = new speech.SpeechClient();
const ffmpegPath = ffmpegInstaller.path;

function convertWebmToWav(inputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath + '.wav';

    const args = [
      '-y',          // 덮어쓰기
      '-i', inputPath,
      '-acodec', 'pcm_s16le', // LINEAR16
      '-ac', '1',             // mono
      '-ar', '16000',         // 16kHz
      outputPath,
    ];

    console.log('[STT] ffmpeg cmd:', ffmpegPath, args.join(' '));

    const ff = spawn(ffmpegPath, args);

    ff.stderr.on('data', (data) => {
      // ffmpeg 진행 로그
      // console.log('[ffmpeg]', data.toString());
    });

    ff.on('error', (err) => {
      console.error('[STT] ffmpeg spawn error:', err);
      reject(err);
    });

    ff.on('close', (code) => {
      if (code === 0) {
        console.log('[STT] converted to wav:', outputPath);
        resolve(outputPath);
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

export async function transcribeLocalFile(filePath: string): Promise<string> {

  let targetPath = filePath;

  const ext = path.extname(filePath).toLowerCase();
  if (!ext || ext === '.webm' || ext === '.ogg') {
    // webm/ogg → wav 변환
    targetPath = await convertWebmToWav(filePath);
  }


  // 1) 오디오 파일 읽어서 base64 인코딩
  const file = fs.readFileSync(targetPath);
  console.log('[STT] file size:', file.length, 'path:', targetPath);

  const audio = {
    content: file.toString('base64'),
  };

  // 2) STT 설정
  const config = {
    // 브라우저 MediaRecorder 기본(WebM + Opus) 기준
    // encoding: 'WEBM_OPUS' as const,
    // sampleRateHertz: 48000,
    languageCode: 'ko-KR',
    enableAutomaticPunctuation: true, // 자동 문장부호
    // model: 'latest_long', // 길고 정확한 모델 쓰고 싶으면 (요금 조금 다를 수 있음)
  };

  const request = {
    audio,
    config,
  };

  console.log('[STT] sending recognize request...');

  // 3) STT 호출
  const [response] = await client.recognize(request);

  console.log(
    '[STT] raw response results length:',
    response.results?.length ?? 0,
  );

  if (!response.results || response.results.length === 0) {
    console.warn('[STT] no results in response');
    return '';
  }

  const transcription =
    response.results
      ?.map((r: any) => r.alternatives?.[0]?.transcript ?? '')
      .join('\n') ?? '';

    console.log('[STT] transcription (first 200 chars):', transcription.slice(0, 200));


  // webm → wav 변환했으면, wav 임시 파일 삭제
  if (targetPath !== filePath) {
    fs.unlink(targetPath, (err) => {
      if (err) console.error('wav 삭제 실패:', err);
    });
  }

  return transcription;
}
