import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { WiringStep } from '@/schema'

export interface WiringState { checked: boolean[]; activeStep: number | null }
export type WiringAction =
  | { type: 'check' | 'uncheck'; step: number }
  | { type: 'active'; step: number | null }
  | { type: 'reset'; state: WiringState }

export function wiringReducer(state: WiringState, action: WiringAction): WiringState {
  if (action.type === 'reset') return action.state
  if (action.type === 'active') return { ...state, activeStep: action.step }
  if (action.step < 0 || action.step >= state.checked.length) return state
  const checked = state.checked.slice(); checked[action.step] = action.type === 'check'
  const activeStep = action.type === 'check'
    ? Math.min(action.step + 1, checked.length - 1)
    : action.step
  return { checked, activeStep }
}

export function useWiringSteps(steps: WiringStep[], initialChecked?: boolean[]): WiringState & { completed: boolean; checkStep: (step: number) => void; uncheckStep: (step: number) => void; setActiveStep: (step: number | null) => void } {
  const initial = useMemo(() => {
    const checked = Array.from({ length: steps.length }, (_, index) => initialChecked?.[index] === true)
    const firstUnchecked = checked.findIndex((value) => !value)
    return { checked, activeStep: steps.length ? (firstUnchecked < 0 ? steps.length - 1 : firstUnchecked) : null }
  }, [steps.length, initialChecked])
  const [state, dispatch] = useReducer(wiringReducer, initial)
  useEffect(() => dispatch({ type: 'reset', state: initial }), [initial])
  const checkStep = useCallback((step: number) => dispatch({ type: 'check', step }), [])
  const uncheckStep = useCallback((step: number) => dispatch({ type: 'uncheck', step }), [])
  const setActiveStep = useCallback((step: number | null) => dispatch({ type: 'active', step }), [])
  return { ...state, completed: state.checked.length > 0 && state.checked.every(Boolean), checkStep, uncheckStep, setActiveStep }
}
