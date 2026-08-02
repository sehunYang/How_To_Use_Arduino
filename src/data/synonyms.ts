import type { SynonymMap } from '@/search'

/**
 * Stub global synonym dictionary (plan `meta/synonyms`). This is a local,
 * hand-authored placeholder standing in for the real Firestore document —
 * it exists so search/matching logic and its tests have something concrete
 * to run against before Phase 5 authors real content and Phase 4 builds the
 * authoring UI that would normally grow this map from actual student
 * search-failure logs.
 */
export const synonyms: SynonymMap = {
  진자: ['추', '시계추', '흔들'],
  주기: ['왔다갔다', '반복'],
  에너지: ['힘', '동력', '보존'],
  자유낙하: ['떨어지는', '떨어뜨린', '낙하'],
  가속도: ['속도 변화', '중력가속도'],
  거리: ['간격', '떨어진'],
  온도: ['열', '따뜻', '뜨거운'],
  습도: ['축축', '수분'],
  환풍기: ['팬', '환기'],
  빛: ['조도', '밝기', '밝은'],
  자동차: ['로봇차', '차'],
  자율주행: ['스스로 움직이는', '알아서 움직이는'],
  회전수: ['RPM', '회전 속도', '몇 바퀴'],
  자석: ['홀센서', '자기장'],
  장애물: ['앞에 뭐가 있으면', '피해서'],
  초음파: ['거리 센서'],
  야행성: ['밤에만', '밤에'],
  감지: ['알려주는', '지나가면'],
  냉각: ['식는', '식는 과정'],
  뉴턴: ['냉각법칙'],
  생장: ['자라는', '자라는지'],
  주차: ['주차할 때'],
  경보: ['알려주는', '소리로'],
  부저: ['소리'],
  주소충돌: ['주소가 같은', '같은 주소'],
  '채널 선택 장치': ['멀티플렉서', '여러 개 연결', '여러개 연결'],
}
