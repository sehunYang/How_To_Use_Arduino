/**
 * 브라우저 안에서 만든 파일을 학생의 컴퓨터로 내려받습니다.
 *
 * CSV 저장과 그래프 PNG 저장이 같은 방식으로 동작해야 해서 한곳에 모았습니다.
 * 만든 주소(URL)는 클릭 직후 반드시 되돌려 주어야 메모리가 남지 않습니다.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** `이름-20260801-134500.확장자` 형태의 파일 이름을 만듭니다. */
export function createTimestampedFilename(prefix: string, extension: string, date = new Date()) {
  const twoDigits = (value: number) => String(value).padStart(2, '0')
  const day = `${date.getFullYear()}${twoDigits(date.getMonth() + 1)}${twoDigits(date.getDate())}`
  const time = `${twoDigits(date.getHours())}${twoDigits(date.getMinutes())}${twoDigits(date.getSeconds())}`
  return `${prefix}-${day}-${time}.${extension}`
}
