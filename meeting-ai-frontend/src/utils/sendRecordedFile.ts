const API_URL = import.meta.env.VITE_API_URL

const sendRecordedFile = async (file: File) => {
  const formData = new FormData();
  // ✅ 필드 이름을 백엔드와 동일하게 'file' 로!
  formData.append('file', file);

  const res = await fetch(`${API_URL}/api/meeting/summary/file`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error('요약 요청 실패');
  }

  const data = await res.json();
  console.log('요약 결과:', data.summary);
};

export default sendRecordedFile;