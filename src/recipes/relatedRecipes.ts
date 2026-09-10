/**
 * 가이드가 이름으로만 가리키던 다음 탐구를 눌러서 갈 수 있게 만듭니다.
 *
 * '더 나아가기'의 마지막 칸은 111개 레시피 모두가 저장소에 실제로 있는 레시피
 * 제목을 따옴표로 적습니다. 그런데 그 제목은 글자일 뿐이라, 다음 탐구로 넘어가려면
 * 학생이 제목을 손으로 옮겨 적어 목록에서 다시 찾아야 했습니다. 이름이 이미
 * 정확하므로 목록만 있으면 링크로 바꿀 수 있습니다.
 *
 * 목록을 인자로 받는 이유는 번들 크기입니다. 이 파일이 전체 레시피를 직접
 * 가져오면 레시피 하나만 여는 화면에도 111편이 함께 실립니다. 화면은 이미
 * 검색 색인(제목과 id만 든 가벼운 목록)을 내려받으므로 그것을 넘겨 씁니다.
 */
export interface RecipeLink {
  id: string
  title: string
}

/** 따옴표로 감싼 제목만 봅니다. 본문에 우연히 섞인 같은 낱말을 링크로 바꾸지 않기 위해서입니다. */
const QUOTED_TITLE = /[“"]([^”"\n]{2,80})[”"]/g

export function linkRecipeTitles(markdown: string, catalog: RecipeLink[], currentId: string): string {
  if (!catalog.length) return markdown
  const idByTitle = new Map(catalog.map((entry) => [entry.title, entry.id]))
  return markdown.replace(QUOTED_TITLE, (whole, title: string) => {
    const id = idByTitle.get(title)
    // 지금 보고 있는 레시피를 자기 자신으로 보내는 링크는 만들지 않습니다.
    return id && id !== currentId ? `[${title}](/recipes/${id})` : whole
  })
}
