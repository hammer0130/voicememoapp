import { useState, type ChangeEvent } from 'react';

type SummaryResponse = {
  ok: boolean;
  summary?: string;
  file?: {
    originalName: string;
    size: number;
    mimeType: string;
  };
  message?: string;
  error?: string;
};

const API_URL = import.meta.env.VITE_API_URL

function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 파일 선택 핸들러
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
    setData(null);
    setError(null);
  };

  // 업로드 핸들러
  const handleUpload = async () => {
    if (!file) {
      setError('먼저 파일을 선택해주세요..');
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${API_URL}/api/meetings/summary/file`,
        {
          method: 'POST',
          body: formData,
        },
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || '업로드 실패');
      }

      const json = (await response.json()) as SummaryResponse;
      setData(json);
    } catch (err: any) {
      // console.error(e);
      // setError(e?.message ?? '요약 요청 중 오류가 발생했습니다.');
      console.error('[summary/file] error:', err);

      // Gemini 쪽에서 내려준 정보가 있으면 한 번 더 찍기
      if (err.response) {
        console.error('Gemini status:', err.response.status);
        console.error('Gemini data:', err.response.data);
      }
    
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <h2>녹음된 파일 업로드 → 회의 요약</h2>

      <div style={{ marginBottom: '0.5rem' }}>
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
        />
      </div>

      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || loading}
      >
        {loading ? '업로드 중...' : '업로드 & 요약 요청'}
      </button>

      {error && (
        <div style={{ marginTop: '1rem', color: 'red' }}>
          {error}
        </div>
      )}

      {data && (
        <div style={{ marginTop: '1rem' }}>
          {data.file && (
            <p>
              <strong>파일:</strong> {data.file.originalName} (
              {Math.round(data.file.size / 1024)} KB)
            </p>
          )}
          {data.summary && (
            <>
              <h3>요약 결과</h3>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{data.summary}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default FileUpload;
