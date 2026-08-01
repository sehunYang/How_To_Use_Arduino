import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { reloadBypassingCache } from '@/lib/cacheBust'

/**
 * 화면 코드를 내려받다 실패했을 때 앱 전체가 사라지지 않게 막는 울타리.
 *
 * 화면은 모두 필요할 때 내려받는데(`App.tsx`), GitHub Pages는 배포할 때마다 파일
 * 이름에 붙은 해시를 통째로 갈아치웁니다. 배포 전에 열어 둔 탭은 옛 이름을 기억하고
 * 있어서 아직 받지 않은 화면으로 넘어가는 순간 404를 만납니다. 그 오류가 위로
 * 올라가면 React는 루트 전체를 들어내고, 학생에게는 아무것도 없는 화면만 남습니다.
 *
 * 그래서 배포 때문에 생긴 실패는 한 번만 새로 고쳐 새 파일을 받게 하고, 그래도
 * 안 되면(연결이 끊겼거나 다른 이유라면) 이유와 함께 되돌아갈 길을 보여 줍니다.
 *
 * 새로 고침은 반드시 캐시를 건너뛰어야 합니다. index.html 자체가 10분간 캐시되므로
 * 평범한 새로 고침은 옛 파일 이름이 적힌 문서를 다시 읽어 똑같이 실패합니다.
 */

const RELOAD_MARK = 'arduino-stale-chunk-reload'
/** 이 시간 안에 이미 새로 고쳤다면 다시 고치지 않습니다. 되풀이해서 새로 고치는 일을 막습니다. */
const RELOAD_COOLDOWN_MS = 30_000

/** 브라우저가 화면 코드를 받지 못했을 때 내는 메시지들. 브라우저마다 문구가 다릅니다. */
const STALE_CHUNK_PATTERN = /dynamically imported module|module script failed|ChunkLoadError|Loading chunk/i

export function isStaleChunkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return STALE_CHUNK_PATTERN.test(message)
}

/** 시크릿 창처럼 저장이 막힌 곳에서도 화면이 멈추지 않도록 실패를 삼킵니다. */
function readReloadMark() {
  try {
    return Number(window.sessionStorage.getItem(RELOAD_MARK) ?? 0)
  } catch {
    return 0
  }
}

function writeReloadMark(at: number) {
  try {
    window.sessionStorage.setItem(RELOAD_MARK, String(at))
  } catch {
    // 저장하지 못하면 새로 고침을 한 번 더 시도할 수 있지만, 화면이 멈추는 것보다 낫습니다.
  }
}

interface RouteErrorBoundaryProps {
  children: ReactNode
  /** 이 값이 바뀌면(주소가 바뀌면) 오류 화면을 걷어내고 다시 그려 봅니다. */
  resetKey: string
  /** 테스트가 실제 새로 고침을 가로챌 수 있도록 열어 둔 자리 */
  reload?: () => void
  now?: () => number
}

interface RouteErrorBoundaryState {
  failed: boolean
  stale: boolean
  /** 화면에 그대로 보여 줄 오류 문구. 이 사이트에는 오류를 모아 보는 곳이 없어서 화면이 유일한 단서입니다. */
  detail: string
}

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { failed: false, stale: false, detail: '' }

  static getDerivedStateFromError(error: unknown): RouteErrorBoundaryState {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    return { failed: true, stale: isStaleChunkError(error), detail }
  }

  componentDidCatch(error: unknown) {
    if (!isStaleChunkError(error)) return

    const now = this.props.now ?? Date.now
    const at = now()
    if (at - readReloadMark() < RELOAD_COOLDOWN_MS) return

    writeReloadMark(at)
    const reload = this.props.reload ?? reloadBypassingCache
    reload()
  }

  componentDidUpdate(previous: RouteErrorBoundaryProps) {
    // 다른 화면으로 옮겨 갔다면 그 화면은 멀쩡할 수 있으니 다시 그려 봅니다.
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false, stale: false, detail: '' })
    }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div role="alert" className="mx-auto max-w-2xl py-20 text-center">
        <h1 className="text-3xl font-semibold">화면을 불러오지 못했어요</h1>
        <p className="mt-4 text-body text-muted">
          {this.state.stale
            ? '안내서가 방금 새로 올라가서 이 화면의 파일 이름이 바뀌었어요. 새로 고치면 이어서 볼 수 있습니다.'
            : '화면을 그리는 중에 문제가 생겼어요. 새로 고쳐도 같은 화면이 나오면 다른 메뉴로 이동해 보세요.'}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={() => (this.props.reload ?? reloadBypassingCache)()}>
            새로 고침
          </Button>
          <Link
            to="/"
            className="inline-flex h-12 items-center rounded-card border border-border px-6 text-body hover:bg-muted-background"
          >
            처음으로
          </Link>
        </div>
        {this.state.detail && (
          <details className="mt-8 text-left">
            <summary className="cursor-pointer text-caption text-muted">자세한 내용 (문제를 알릴 때 이 내용을 함께 알려 주세요)</summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-card border border-border bg-muted-background p-3 text-caption"><code>{this.state.detail}</code></pre>
          </details>
        )}
      </div>
    )
  }
}
