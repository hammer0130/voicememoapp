const API_URL = 'http://localhost:3000/api/meeting/summary/file';

const sendRecordedFile = async (file: File) => {
  const formData = new FormData();
  // ✅ 필드 이름을 백엔드와 동일하게 'file' 로!
  formData.append('file', file);

  const res = await fetch(API_URL, {
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