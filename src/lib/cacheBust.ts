/**
 * 배포 직후 옛 화면 코드를 붙잡고 있는 탭을 새 코드로 갈아 끼우는 새로 고침.
 *
 * GitHub Pages는 index.html을 `Cache-Control: max-age=600`으로 내려 줍니다. 배포하면
 * 해시가 붙은 파일 이름은 즉시 바뀌지만, 브라우저는 최대 10분 동안 옛 index.html을
 * 캐시에서 그대로 씁니다. 그래서 평범한 `location.reload()`로는 같은 옛 파일 이름을
 * 다시 찾아 똑같이 실패합니다.
 *
 * 주소에 표시를 하나 붙이면 캐시 열쇠가 달라져 반드시 새로 받아 옵니다. 받아 온 뒤에는
 * 표시를 지워, 학생이 주소를 복사해 공유해도 군더더기가 남지 않게 합니다.
 */

export const CACHE_BUST_PARAM = '_build'

/** 캐시를 건너뛰고 지금 주소를 다시 열어 새 화면 코드를 받아 옵니다. */
export function reloadBypassingCache(at = Date.now()) {
  const url = new URL(window.location.href)
  url.searchParams.set(CACHE_BUST_PARAM, String(at))
  // replace라서 뒤로 가기 기록에 새로 고침 한 번이 끼어들지 않습니다.
  window.location.replace(url.toString())
}

/** 주소창에 남은 새로 고침 표시를 지웁니다. 화면을 다시 그리지는 않습니다. */
export function stripCacheBustParam() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(CACHE_BUST_PARAM)) return

  url.searchParams.delete(CACHE_BUST_PARAM)
  window.history.replaceState(window.history.state, '', url.toString())
}
