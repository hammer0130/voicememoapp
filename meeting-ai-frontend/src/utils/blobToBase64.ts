export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64 = result.split(',')[1]; // data:...;base64,XXXX
        resolve(base64);
      } else {
        reject(new Error('Failed to read blob as data URL'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}