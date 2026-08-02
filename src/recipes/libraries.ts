/**
 * 스케치 맨 위의 `#include <...>` 줄이 요구하는 라이브러리를 찾아냅니다.
 *
 * 어느 레시피도 "무엇을 설치해야 하는지"를 적어 두지 않았습니다. 아두이노를
 * 처음 여는 학생은 코드를 붙여 넣고 업로드를 누른 뒤 `MPU6050.h: No such file
 * or directory`라는 빨간 글을 만나고, 그 줄만으로는 다음에 무엇을 해야 하는지
 * 알 수 없습니다. 설치 목록을 사람이 레시피마다 적어 두면 스케치를 고칠 때
 * 같이 고쳐지지 않으므로, 스케치에서 직접 읽습니다.
 */

export interface SketchLibrary {
  /** 스케치가 부르는 헤더 파일 이름. 컴파일 오류 문구와 그대로 맞춰 두면 찾기 쉽습니다. */
  header: string
  /** 라이브러리 관리자 검색창에 넣을 말. */
  search: string
  note?: string
}

/** 아두이노 IDE에 이미 들어 있어 따로 설치하지 않는 헤더. */
const BUILTIN_HEADERS = new Set([
  'Wire.h',
  'SPI.h',
  'EEPROM.h',
  'Servo.h',
  'SoftwareSerial.h',
  'math.h',
  'stdint.h',
  'string.h',
  'avr/interrupt.h',
  'avr/io.h',
])

const ADAFRUIT_UNIFIED = '설치할 때 함께 설치할지 물으면 “Install all”을 눌러 Adafruit Unified Sensor까지 받으세요.'

const LIBRARY_BY_HEADER: Record<string, Omit<SketchLibrary, 'header'>> = {
  'MPU6050.h': {
    search: 'MPU6050',
    note: '검색 결과가 여러 개면 Electronic Cats가 올린 MPU6050을 고르세요.',
  },
  'Adafruit_BME280.h': { search: 'Adafruit BME280 Library', note: ADAFRUIT_UNIFIED },
  'Adafruit_TSL2591.h': { search: 'Adafruit TSL2591 Library', note: ADAFRUIT_UNIFIED },
  'Adafruit_INA219.h': { search: 'Adafruit INA219', note: ADAFRUIT_UNIFIED },
  'OneWire.h': { search: 'OneWire', note: 'Paul Stoffregen가 올린 것을 고르세요.' },
  'DallasTemperature.h': {
    search: 'DallasTemperature',
    note: 'OneWire 라이브러리도 함께 있어야 동작합니다.',
  },
  'TCA9548A.h': { search: 'TCA9548A' },
}

export interface SketchDependencies {
  /** 라이브러리 관리자에서 받아야 하는 것. */
  install: SketchLibrary[]
  /** 이미 들어 있어 아무것도 하지 않아도 되는 것. 없다고 걱정하지 않도록 함께 보여 줍니다. */
  builtin: string[]
}

export function librariesFor(sketch: string): SketchDependencies {
  const headers = [...new Set(
    [...sketch.matchAll(/^\s*#include\s*<([^>]+)>/gm)].map((match) => match[1].trim()),
  )]
  return {
    install: headers
      .filter((header) => !BUILTIN_HEADERS.has(header))
      .map((header) => ({
        header,
        ...(LIBRARY_BY_HEADER[header] ?? { search: header.replace(/\.h$/, '') }),
      })),
    builtin: headers.filter((header) => BUILTIN_HEADERS.has(header)),
  }
}
