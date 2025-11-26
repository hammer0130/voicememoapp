import { useRef, useState } from 'react';

const RecordAndUpload = () => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState<string | null>(null); // 결과 텍스트
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startRecording = async () => {
    setError(null);
    setResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // 여기서 blob 만들고 서버로 전송
        if (!chunksRef.current.length) {
          console.warn('no chunks');
          return;
        }

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];

        setLoading(true);
        setError(null);

        try {
          const formData = new FormData();
          // ✅ 백엔드에서 기대하는 필드 이름: 'audio'
          formData.append('audio', blob, 'recording.webm');

          const res = await fetch('http://localhost:3000/api/stt', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'STT 요청 실패');
          }

          const data = await res.json();
          console.log('STT result:', data.text);
          setResult(data.text ?? '(인식된 텍스트가 없습니다.)');
        } catch (e: any) {
          console.error(e);
          setError(e?.message ?? '오디오 업로드 중 오류가 발생했습니다.');
        } finally {
          setLoading(false);
          // 스트림 정리
          stream.getTracks().forEach((t) => t.stop());
        }
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

    // ❗ 이걸 호출해야 ondataavailable → onstop → 업로드 로직이 돈다
    mediaRecorder.stop();
    setRecording(false);
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <h2>회의 녹음 테스트</h2>

      <div style={{ marginBottom: '1rem' }}>
        {!recording ? (
          <button onClick={startRecording}>녹음 시작</button>
        ) : (
          <button onClick={stopRecording}>녹음 종료 &amp; 전송</button>
        )}
      </div>

      {loading && <p>업로드/처리 중...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {result && (
        <div style={{ marginTop: '1rem' }}>
          <h3>STT 결과</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{result}</p>
        </div>
      )}
    </div>
  );
};

export default RecordAndUpload;
