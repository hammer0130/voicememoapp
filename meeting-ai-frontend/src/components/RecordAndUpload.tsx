import { useRef, useState } from 'react';

const RecordAndUpload = () => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (e: any) {
      console.error(e);
      setError('마이크 접근 권한을 확인해주세요.');
    }
  };

  const stopRecording = () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

    mediaRecorder.stop();
    setRecording(false);

    // stop 이후 chunks를 모아서 업로드
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      await uploadAudio(blob);
      const stream = (mediaRecorder as any).stream as MediaStream | undefined;
      stream?.getTracks().forEach((t) => t.stop());
    };
  };

  const uploadAudio = async (blob: Blob) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');

      const res = await fetch('http://localhost:8000/api/meetings/summarize-audio', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '업로드 실패');
      }

      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? '오디오 업로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <h2>회의 녹음 테스트</h2>

      <div style={{ marginBottom: '1rem' }}>
        {!recording ? (
          <button onClick={startRecording}>녹음 시작</button>
        ) : (
          <button onClick={stopRecording}>녹음 종료 & 업로드</button>
        )}
      </div>

      {loading && <p>업로드/처리 중...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {result && (
        <div style={{ marginTop: '1rem' }}>
          <h3>서버 응답</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default RecordAndUpload;
