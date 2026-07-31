/**
 * 화면에 그려진 그래프 SVG를 그대로 PNG 그림 파일로 저장합니다.
 *
 * 보고서에 붙일 그림이므로 화면에 보이는 것과 저장되는 그림이 달라지면 안 됩니다.
 * 그래서 그래프를 새로 그리지 않고 이미 그려진 SVG를 복사해 사용하고, 마우스로
 * 가리켰을 때만 나타나는 설명 상자(`data-chart-overlay`)만 떼어 냅니다.
 */
import { createTimestampedFilename, downloadBlob } from '@/lib/downloadFile'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

/** 인쇄해도 글자가 깨지지 않도록 화면 배율의 몇 배로 그릴지 정합니다. */
export const CHART_EXPORT_SCALE = 2

export function createChartPngFilename(date = new Date()) {
  return createTimestampedFilename('arduino-graph', 'png', date)
}

/** 저장용으로 정리한 SVG 문자열을 만듭니다. */
export function serializeChartSvg(svg: SVGSVGElement, width: number, height: number): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.querySelectorAll('[data-chart-overlay]').forEach((overlay) => overlay.remove())
  clone.setAttribute('xmlns', SVG_NAMESPACE)
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  return new XMLSerializer().serializeToString(clone)
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('그래프를 그림으로 바꾸지 못했습니다.')))
    image.src = source
  })
}

export interface ChartPngOptions {
  filename?: string
  scale?: number
}

/**
 * 그래프를 PNG로 저장합니다. 실패하면 이유를 담은 오류를 던지므로,
 * 부르는 쪽에서 학생에게 보여 줄 문구를 정하면 됩니다.
 */
export async function downloadChartPng(svg: SVGSVGElement, options: ChartPngOptions = {}) {
  const { filename = createChartPngFilename(), scale = CHART_EXPORT_SCALE } = options
  const viewBox = svg.viewBox.baseVal
  const width = viewBox?.width || svg.clientWidth
  const height = viewBox?.height || svg.clientHeight
  if (!width || !height) throw new Error('그래프 크기를 읽지 못했습니다.')

  const source = serializeChartSvg(svg, width, height)
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('이 브라우저에서는 그림 저장을 지원하지 않습니다.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('그림 파일을 만들지 못했습니다.')
  downloadBlob(blob, filename)
}
