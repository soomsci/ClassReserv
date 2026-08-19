/**
 * 교사명 마스킹 (가운데 글자 가리기)
 *   2글자  김수     -> 김O
 *   3글자  김철수   -> 김O수
 *   4글자+ 남궁철수 -> 남OO수
 *   1글자·기타      -> 그대로
 *
 * 운영(Supabase) 환경에서는 이 규칙과 동일한 SQL 함수 mask_name() 이 뷰에서 수행한다.
 * 원본 이름은 서버 밖으로 나가지 않아야 하므로, 이 함수는 서버 코드에서만 사용한다.
 */
export function maskName(name: string): string {
  const trimmed = (name ?? "").trim();
  const chars = Array.from(trimmed);

  if (chars.length <= 1) return trimmed;
  if (chars.length === 2) return `${chars[0]}O`;

  const middle = "O".repeat(chars.length - 2);
  return `${chars[0]}${middle}${chars[chars.length - 1]}`;
}
