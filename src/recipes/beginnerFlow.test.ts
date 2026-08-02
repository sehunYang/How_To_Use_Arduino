import { describe, expect, it } from 'vitest'
import { studentRecipes } from '@/data/studentCatalog'
import { phase5Recipes } from '@/data/phase5'
import { phase6Recipes } from '@/data/phase6'
import { firstRunTroubleshooting, safetyNotice } from './firstRun'
import { librariesFor } from './libraries'
import { hasPartLabel, jumperWireLabel, partsFor, shortComponentLabel } from './parts'

/**
 * 이 화면의 독자는 아두이노도, 배선도, 코딩도 처음인 학생입니다. 아래 검사는
 * "레시피 하나가 예쁘게 나오는가"가 아니라 **모든 레시피가 빠짐없이** 그 학생이
 * 막히는 자리를 메우고 있는지를 봅니다. 새 레시피를 넣을 때 준비물이나 설치할
 * 라이브러리를 빠뜨리면 여기서 걸립니다.
 */
const allRecipes = [...studentRecipes, ...phase5Recipes, ...phase6Recipes]

describe('모든 레시피의 첫 실행 안내', () => {
  it('부품 목록을 배선에서 끌어내 빈 목록을 남기지 않는다', () => {
    for (const recipe of allRecipes) {
      const parts = partsFor(recipe)
      expect(parts.always.length, recipe.id).toBeGreaterThan(0)
      expect(parts.specific.length, recipe.id).toBeGreaterThan(0)
      expect(parts.wires.length, recipe.id).toBeGreaterThan(0)
      for (const line of parts.specific) {
        expect(line.count, `${recipe.id} / ${line.name}`).toBeGreaterThan(0)
      }
      // 옮길 이름을 모르는 토큰이 그대로 새어 나오면 무엇을 사야 할지 알 수 없습니다.
      for (const step of recipe.wiring) {
        for (const endpoint of [step.from, step.to]) {
          const component = endpoint.split('.')[0]
          if (component === 'UNO' || component === 'BB') continue
          expect(hasPartLabel(component), `${recipe.id} / ${component}`).toBe(true)
        }
      }
    }
  })

  it('센서를 여러 개 쓰는 레시피는 개수를 세어 보여 준다', () => {
    const threeLightSensors = phase5Recipes.find((recipe) => recipe.id === 'e5-spatial-light-map')
    const line = partsFor(threeLightSensors!).specific.find((entry) => entry.name.includes('TSL2591'))
    expect(line?.count).toBe(3)
  })

  it('스케치가 부르는 모든 헤더가 설치 안내나 기본 제공 목록으로 이어진다', () => {
    for (const recipe of allRecipes) {
      const { install, builtin } = librariesFor(recipe.sketch)
      const headers = [...recipe.sketch.matchAll(/^\s*#include\s*<([^>]+)>/gm)].map((match) => match[1])
      expect(install.length + builtin.length, recipe.id).toBe(new Set(headers).size)
      for (const library of install) {
        // 검색어가 헤더 파일 이름 그대로면 라이브러리 관리자에서 찾지 못합니다.
        expect(library.search, `${recipe.id} / ${library.header}`).not.toContain('.h')
      }
    }
  })

  it('배선하기 전에 읽을 안전 안내를 모든 레시피에서 만들어 낸다', () => {
    for (const recipe of allRecipes) {
      const notice = safetyNotice(recipe.body)
      expect(notice, recipe.id).not.toHaveLength(0)
      expect(notice, recipe.id).toContain('전원')
      expect(notice, recipe.id).not.toContain(':::')
    }
  })

  it('시리얼 모니터 속도를 레시피의 실제 속도로 안내한다', () => {
    const pendulum = studentRecipes.find((recipe) => recipe.id === 'pendulum')!
    expect(pendulum.baudRate).toBe(115200)
    expect(firstRunTroubleshooting(pendulum.baudRate).map((item) => item.fix).join(' '))
      .toContain('115200 baud')
  })
})

describe('부품 이름 옮기기', () => {
  it('저항은 토큰이 아니라 값으로 읽어 준다', () => {
    expect(shortComponentLabel('RESISTOR_4700')).toBe('4.7 kΩ 저항')
    expect(shortComponentLabel('RESISTOR_220')).toBe('220 Ω 저항')
    expect(shortComponentLabel('CDS_RESISTOR_2')).toBe('10 kΩ 저항')
  })

  it('센서 토큰은 기판에 인쇄된 글자 그대로 둔다', () => {
    expect(shortComponentLabel('MPU6050')).toBe('MPU6050')
    expect(shortComponentLabel('TSL2591_2')).toBe('TSL2591_2')
  })

  /** 부하는 레시피마다 다른 물건이라 한 값으로 못 박으면 어느 한쪽이 틀립니다. */
  it('부하를 특정 저항값으로 단정하지 않는다', () => {
    expect(shortComponentLabel('LOAD')).toBe('실험용 부하')
  })

  it('점퍼선 종류를 양 끝의 소켓 모양에서 고른다', () => {
    expect(jumperWireLabel('UNO.5V', 'BB.tp.1')).toBe('수-수(MM) 점퍼선')
    expect(jumperWireLabel('MPU6050.VCC', 'UNO.5V')).toBe('수-암(MF) 점퍼선')
    expect(jumperWireLabel('TSL2591_1.SDA', 'TCA9548A.SD0')).toBe('암-암(FF) 점퍼선')
  })
})

describe('꽂아야 할 부품은 배선 단계로 선언한다', () => {
  /**
   * 안내 문장에만 적힌 부품은 회로도에도, 준비물에도 나오지 않습니다.
   * 주차 경보기의 220 Ω 저항이 그랬고, 학생은 LED를 D4에 그대로 꽂았습니다.
   */
  it('저항을 말하는 배선 단계에는 저항 단자가 실제로 있다', () => {
    for (const recipe of allRecipes) {
      for (const step of recipe.wiring) {
        if (!/저항/.test(step.text)) continue
        expect(
          [step.from, step.to].some((endpoint) => /RESISTOR/.test(endpoint)),
          `${recipe.id}: ${step.text}`,
        ).toBe(true)
      }
    }
  })
})
