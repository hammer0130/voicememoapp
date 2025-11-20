export type SpeakerSegment = {
  speaker: string; // "SPEAKER_00", "SPEAKER_01" ...
  start: number;   // 초 단위
  end: number;
  text: string;
};

export type ApiResponseWithSpeakers = {
  transcript: string;        // 전체 텍스트 (화자 태그 포함 or 미포함, 백엔드 구현에 맞게)
  summary: string;           // 요약
  segments: SpeakerSegment[]; // 화자별 구간
};
