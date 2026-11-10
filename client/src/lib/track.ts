/**
 * GA4 이벤트. GA 가 없으면(로컬, 프리뷰, NEXT_PUBLIC_GA_ID 없음) 아무 일도 하지 않는다.
 * 리뉴얼 홈에서 어디까지 보고 무엇을 누르는지 재기 위해 쓴다.
 *   story_stage     X-RAY 스토리 장면 도달 (stage: 0~5). 장면마다 한 번만
 *   story_skip      스토리 건너뛰기
 *   lab_scenario    시뮬레이터 시나리오 선택 (scenario: 키)
 *   cta_click       문의, 상담 버튼 (where: 위치)
 * @see docs/renewal-2026-11.md
 */
type Gtag = (cmd: "event", name: string, params?: Record<string, string | number>) => void;

export function track(name: string, params?: Record<string, string | number>): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  gtag?.("event", name, params);
}
