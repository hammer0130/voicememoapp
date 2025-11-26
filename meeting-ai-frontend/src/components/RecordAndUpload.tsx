import { useRef, useState } from 'react';

const RecordAndUpload = () => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState<string | null>(null); // 요약 텍스트만 저장
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 공통: Blob → 서버 업로드
  const uploadAudio = async (blob: Blob) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      // ✅ 백엔드에서 기대하는 필드 이름: 'file'
      formData.append('file', blob, 'recording.webm');

      const res = await fetch(
        'http://localhost:8000/api/meetings/summary/file',
        {
          method: 'POST',
          body: formData,
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '업로드 실패');
      }

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.message || '요약 처리 실패');
      }

      // 백엔드에서 보내주는 summary 필드만 사용
      setResult(data.summary ?? '(요약 결과가 없습니다.)');
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? '오디오 업로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    setError(null);
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

      // ✅ onstop은 여기서 한 번만 설정
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await uploadAudio(blob);

        // 스트림 정리
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (e: any) {
      console.error(e);
      setError('마이크 접근 권한을 확인해주세요.');
    }
  };

  const stopRecording = async () => {
    // const mediaRecorder = mediaRecorderRef.current;
    // if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

    // mediaRecorder.stop(); // onstop 핸들러가 자동 실행됨
    // setRecording(false);


    if (!chunksRef.current.length) return;

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];

    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');

    const res = await fetch('http://localhost:3000/api/stt', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    console.log('STT result:', data.text);
    setRecording(false);
    // mediaRecorder.stop();
    
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <h2>회의 녹음 테스트</h2>

      <div style={{ marginBottom: '1rem' }}>
        {!recording ? (
          <button onClick={startRecording}>녹음 시작</button>
        ) : (
          <button onClick={stopRecording}>녹음 종료 &amp; 업로드</button>
        )}
      </div>

      {loading && <p>업로드/처리 중...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {result && (
        <div style={{ marginTop: '1rem' }}>
          <h3>요약 결과</h3>
          {/* pre 대신 일반 텍스트로 표시 */}
          <p style={{ whiteSpace: 'pre-wrap' }}>{result}</p>
        </div>
      )}
    </div>
  );
};

export default RecordAndUpload;
