import { useRef, useState } from 'react';
import { blobToBase64 } from '../utils/blobToBase64'; // 경로는 프로젝트 구조에 맞게 수정

export function RecordAndUpload() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ text?: string; summary?: string } | null>(
    null,
  );

  // ✅ 1) 여기! 컴포넌트 안, 훅들 밑에 위치
  const handleRecordingFinished = async (blob: Blob) => {
    try {
      setLoading(true);
      setResult(null);

      const audioBase64 = await blobToBase64(blob);

      const res = await fetch('/api/meetings/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: blob.type,
          originalName: 'recording.webm',
        }),
      });

      const data = await res.json();
      // /api/meetings/analyze 에서 { ok, text } 형태로 응답한다고 가정
      setResult({ text: data.text });
    } catch (err) {
      console.error('handleRecordingFinished error:', err);
      alert('STT 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ 2) 녹음 시작
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        // ✅ 녹음이 끝난 시점에서 여기서 호출!
        await handleRecordingFinished(blob);
        // 스트림 정리
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error('녹음 시작 실패:', err);
      alert('마이크 권한을 확인해주세요.');
    }
  };

  // ✅ 3) 녹음 종료
  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setRecording(false);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        {!recording ? (
          <button onClick={startRecording} disabled={loading}>
            🎙️ 녹음 시작
          </button>
        ) : (
          <button onClick={stopRecording} disabled={loading}>
            ⏹ 녹음 종료
          </button>
        )}
      </div>

      {loading && <p>처리 중입니다...</p>}

      {result?.text && (
        <div>
          <h3>STT 결과</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{result.text}</pre>
        </div>
      )}
    </div>
  );
}
