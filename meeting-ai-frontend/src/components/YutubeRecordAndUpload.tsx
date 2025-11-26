import { useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL

const YoutubeRecordAndUpload = () => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null); // 화면/탭 캡처 스트림
  const chunksRef = useRef<BlobPart[]>([]);

  const [recording, setRecording] = useState(false);
  // const [videoUrl, setVideoUrl] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // const isYoutubeUrl = (url: string) => {
  //   try {
  //     const u = new URL(url);
  //     return (
  //       u.hostname.includes('youtube.com') ||
  //       u.hostname.includes('youtu.be')
  //     );
  //   } catch {
  //     return false;
  //   }
  // };

  const startRecording = async () => {
    setError(null);
    setResult(null);

    // (선택) 유튜브 URL 형식만 체크
    // if (videoUrl && !isYoutubeUrl(videoUrl.trim())) {
    //   setError('유효한 유튜브 주소가 아닙니다.');
    //   return;
    // }

    if (
      !('mediaDevices' in navigator) ||
      !(navigator.mediaDevices as any).getDisplayMedia
    ) {
      setError('이 브라우저에서는 탭/화면 캡처(getDisplayMedia)를 지원하지 않습니다.');
      return;
    }

    try {
      // 1) 탭/화면 캡처 (여기서 팝업이 떠야 함)
      const displayStream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: true,
        audio: true,
      });

      // 2) 오디오 트랙만 추출
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        setError('선택한 탭/화면에서 오디오 트랙을 찾지 못했습니다. 유튜브 탭이 맞는지 확인해주세요.');
        displayStream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        return;
      }

      const audioOnlyStream = new MediaStream();
      audioTracks.forEach((track: any) => audioOnlyStream.addTrack(track));

      // 3) 오디오 전용 MediaRecorder
      const mediaRecorder = new MediaRecorder(audioOnlyStream, {
        mimeType: 'audio/webm;codecs=opus', // 오디오 전용
        audioBitsPerSecond: 128_000,        // 비트레이트도 적당히 (더 줄여도 됨)
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;
      displayStreamRef.current = displayStream;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // 기본 onstop: 스트림 정리
      mediaRecorder.onstop = () => {
        // audioOnlyStream은 track stop 시 자동 종료
        audioOnlyStream.getTracks().forEach((t) => t.stop());
        // 원래 화면/탭 캡처 스트림도 정리
        displayStream.getTracks().forEach((t: any) => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (e: any) {
      console.error('getDisplayMedia error:', e);
      if (e?.name === 'NotAllowedError') {
        setError('화면/탭 공유 권한이 거부되었습니다. 브라우저 팝업을 다시 확인해주세요.');
      } else if (e?.name === 'NotFoundError') {
        setError('공유할 수 있는 화면이나 탭을 찾을 수 없습니다.');
      } else {
        setError('탭/화면 캡처 중 오류가 발생했습니다.');
      }
    }
  };

  const stopRecording = () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

    setRecording(false);

    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, {
        type: 'audio/webm', // 오디오 webm
      });

      console.log('録음 blob size:', blob.size, 'bytes');
      await uploadAudio(blob);

      // 혹시 남아 있는 스트림 있으면 정리
      const displayStream = displayStreamRef.current;
      displayStream?.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
    };

    mediaRecorder.stop();
  };

  const uploadAudio = async (blob: Blob) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // 필요하면 여기서도 사이즈 체크 (예: 50MB 이하)
      const MAX_SIZE = 50 * 1024 * 1024;
      if (blob.size > MAX_SIZE) {
        setError('녹음 파일이 너무 큽니다. 녹음 시간을 줄여주세요.');
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', blob, 'youtube-audio.webm');
      // if (videoUrl.trim()) {
      //   formData.append('videoUrl', videoUrl.trim());
      // }

      const res = await fetch(`${API_URL}/api/meetings/summary/youtube`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '업로드/요약 요청 실패');
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
      <h2>유튜브 탭 오디오만 녹음 & 요약</h2>

      <p style={{ fontSize: '0.9rem', color: '#555' }}>
        1) 크롬에서 유튜브 탭을 열고, 이 페이지도 같이 열어둡니다.
        <br />
        2) &quot;녹음 시작&quot;을 누르면, 공유할 탭/화면을 선택하는 팝업이 뜹니다.
        <br />
        3) 유튜브 탭을 선택하고 영상을 재생한 뒤, 충분히 재생되면 &quot;녹음 종료&quot;를 눌러주세요.
        <br />
        ※ 실제로 녹음되는 것은 오디오 트랙만이므로 파일 크기가 훨씬 작습니다.
      </p>

      {/* <div style={{ margin: '1rem 0' }}>
        <label style={{ display: 'block', marginBottom: '0.25rem' }}>
          유튜브 영상 URL (선택)
        </label>
        <input
          type="text"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          style={{ width: '100%', maxWidth: '480px', padding: '0.5rem' }}
        />
      </div> */}

      <div style={{ marginBottom: '1rem' }}>
        {!recording ? (
          <button onClick={startRecording}>녹음 시작 (탭 선택)</button>
        ) : (
          <button onClick={stopRecording}>녹음 종료 & 업로드</button>
        )}
      </div>

      {loading && <p>업로드/요약 처리 중...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {result && (
        <div style={{ marginTop: '1rem' }}>
          <h3>요약 결과</h3>
          <div
            style={{
              // background: '#fafafa',
              padding: '1rem',
              borderRadius: '6px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              fontSize: '1rem',
            }}
          >
            {result.summary}
          </div>
        </div>
      )}
    </div>
  );
};

export default YoutubeRecordAndUpload;
