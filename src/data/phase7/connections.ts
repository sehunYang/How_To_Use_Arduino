import type { Connection } from './shared'

/**
 * B·C·D·E 묶음이 함께 쓰는 배선 조각.
 *
 * A 묶음은 레시피마다 배선을 통째로 적었습니다. 장치가 하나씩이라 그 편이
 * 읽기 쉬웠기 때문입니다. 그러나 뒤 묶음은 한 레시피가 센서 둘에 구동장치
 * 둘을 함께 쓰는 일이 흔해, 같은 네 줄을 스물일곱 번 옮겨 적게 됩니다.
 * 옮겨 적은 배선은 한쪽만 고쳐지고 조용히 어긋나므로 여기에 모읍니다.
 *
 * 지키는 약속이 둘 있습니다.
 * 1. 보드 쪽 끝은 **언제나 `to`**에 씁니다. L1의 매니페스트 대조가 `to`만
 *    보므로, 보드 핀을 `from`에 적으면 대응하는 `@pin` 항목이 없다고 걸립니다.
 * 2. 저항을 말하는 문장에는 반드시 저항 단자를 함께 답니다. 문장에만 적힌
 *    부품은 준비물 목록에도 회로도에도 나오지 않습니다.
 */

/** I2C 모듈 네 가닥. 전원 단자 이름만 모듈마다 다릅니다(BME280·TSL2591은 VIN). */
export function i2cModule(token: string, powerPin: string, label: string): Connection[] {
  return [
    { from: `${token}.${powerPin}`, to: 'UNO.5V', color: 'red', text: `${label}의 ${powerPin} 단자를 아두이노 5V에 연결하세요.` },
    { from: `${token}.GND`, to: 'UNO.GND', color: 'black', text: `${label}의 GND 단자를 아두이노 GND에 연결하세요.` },
    { from: `${token}.SDA`, to: 'UNO.A4', color: 'green', text: `${label}의 SDA 단자를 아두이노 A4에 연결하세요.` },
    { from: `${token}.SCL`, to: 'UNO.A5', color: 'yellow', text: `${label}의 SCL 단자를 아두이노 A5에 연결하세요.` },
  ]
}

export const bme280 = (token = 'BME280') => i2cModule(token, 'VIN', 'BME280 온습도·기압 센서')
export const tsl2591 = (token = 'TSL2591') => i2cModule(token, 'VIN', 'TSL2591 조도 센서')
export const mpu6050 = (token = 'MPU6050') => i2cModule(token, 'VCC', 'MPU6050 가속도·자이로 센서')
export const lcd1602 = () => i2cModule('LCD', 'VCC', 'LCD 뒤에 붙은 I2C 변환 보드')

/**
 * 1-Wire 버스. 프로브를 몇 개 달아도 신호선은 하나이고, 신호선을 기본 HIGH로
 * 붙들어 두는 4.7 kΩ 저항이 없으면 통신 자체가 시작되지 않습니다.
 */
export function ds18b20Bus(tokens: string[], dataPin: string): Connection[] {
  const [first] = tokens
  const connections: Connection[] = []
  tokens.forEach((token, index) => {
    const which = tokens.length > 1 ? `${index + 1}번 온도 프로브` : '온도 프로브'
    connections.push(
      { from: `${token}.VCC`, to: 'UNO.5V', color: 'red', text: `${which}의 빨간 선을 아두이노 5V에 연결하세요.` },
      { from: `${token}.GND`, to: 'UNO.GND', color: 'black', text: `${which}의 검은 선을 아두이노 GND에 연결하세요.` },
    )
    if (token === first) {
      connections.push({ from: `${token}.DATA`, to: `UNO.${dataPin}`, color: 'green', text: `${which}의 노란 선(DATA)을 ${dataPin}에 연결하세요.` })
    } else {
      connections.push({ from: `${token}.DATA`, to: `${first}.DATA`, color: 'green', text: `${which}의 노란 선을 1번 프로브의 노란 선과 같은 브레드보드 열에 꽂으세요. 프로브가 몇 개든 신호선은 하나입니다.` })
    }
  })
  connections.push(
    { from: `${first}.DATA`, to: 'RESISTOR_4700.1', color: 'green', text: '신호선과 4.7 kΩ 저항의 한쪽 다리를 같은 브레드보드 열에 꽂으세요.' },
    { from: 'RESISTOR_4700.2', to: 'UNO.5V', color: 'red', text: '4.7 kΩ 저항의 남은 다리를 5V에 연결하세요. 이 저항이 없으면 온도를 아예 읽지 못합니다.' },
  )
  return connections
}

/** CDS는 저항이므로 10 kΩ과 짝지어 분압을 만들어야 전압으로 읽힙니다. */
export function cdsDivider(token: string, resistor: string, analogPin: string, label: string): Connection[] {
  return [
    { from: `${token}.L1`, to: 'UNO.5V', color: 'red', text: `${label} CDS의 한쪽 다리를 5V에 연결하세요.` },
    { from: `${token}.L2`, to: `UNO.${analogPin}`, color: 'blue', text: `${label} CDS의 남은 다리를 ${analogPin}에 연결하세요. 이 지점의 전압을 읽습니다.` },
    { from: `${token}.L2`, to: `${resistor}.1`, color: 'blue', text: `같은 열에 10 kΩ 저항의 한쪽 다리를 함께 꽂으세요.` },
    { from: `${resistor}.2`, to: 'UNO.GND', color: 'black', text: `${label} 쪽 10 kΩ 저항의 남은 다리를 GND에 연결하세요.` },
  ]
}

export function ultrasonic(trigPin: string, echoPin: string): Connection[] {
  return [
    { from: 'HC-SR04.VCC', to: 'UNO.5V', color: 'red', text: '초음파 거리 센서의 VCC를 아두이노 5V에 연결하세요.' },
    { from: 'HC-SR04.GND', to: 'UNO.GND', color: 'black', text: '초음파 거리 센서의 GND를 아두이노 GND에 연결하세요.' },
    { from: 'HC-SR04.TRIG', to: `UNO.${trigPin}`, color: 'blue', text: `초음파를 내보내라고 시키는 TRIG를 ${trigPin}에 연결하세요.` },
    { from: 'HC-SR04.ECHO', to: `UNO.${echoPin}`, color: 'green', text: `돌아온 소리를 알려 주는 ECHO를 ${echoPin}에 연결하세요.` },
  ]
}

export function hallSensor(analogPin: string): Connection[] {
  return [
    { from: 'HBE0704.VCC', to: 'UNO.5V', color: 'red', text: '홀 센서 모듈의 VCC를 아두이노 5V에 연결하세요.' },
    { from: 'HBE0704.GND', to: 'UNO.GND', color: 'black', text: '홀 센서 모듈의 GND를 아두이노 GND에 연결하세요.' },
    { from: 'HBE0704.OUT', to: `UNO.${analogPin}`, color: 'blue', text: `홀 센서의 OUT을 ${analogPin}에 연결하세요.` },
  ]
}

export function led(pin: string): Connection[] {
  return [
    { from: 'RESISTOR_220.1', to: `UNO.${pin}`, color: 'orange', text: `220 Ω 저항의 한쪽 다리를 ${pin}에 연결하세요.` },
    { from: 'LED.ANODE', to: 'RESISTOR_220.2', color: 'orange', text: 'LED의 긴 다리(양극)를 220 Ω 저항의 남은 다리와 같은 브레드보드 열에 꽂으세요.' },
    { from: 'LED.CATHODE', to: 'UNO.GND', color: 'black', text: 'LED의 짧은 다리(음극)를 GND에 연결하세요.' },
  ]
}

export function buzzer(pin: string): Connection[] {
  return [
    { from: 'BUZZER.SIGNAL', to: `UNO.${pin}`, color: 'purple', text: `부저의 신호선(+ 표시가 있는 쪽)을 ${pin}에 연결하세요.` },
    { from: 'BUZZER.GND', to: 'UNO.GND', color: 'black', text: '부저의 남은 다리를 GND에 연결하세요.' },
  ]
}

/** 서보는 아두이노 5V 핀으로 돌리면 보드가 다시 시작됩니다. 전원을 따로 씁니다. */
export function servo(pin: string): Connection[] {
  return [
    { from: 'SERVO.SIGNAL', to: `UNO.${pin}`, color: 'orange', text: `서보의 주황색 신호선을 ${pin}에 연결하세요.` },
    { from: 'SERVO.VCC', to: 'SERVO_SUPPLY.+', color: 'red', text: '서보의 빨간 선을 별도 5V 전원의 + 단자에 연결하세요.' },
    { from: 'SERVO.GND', to: 'SERVO_SUPPLY.-', color: 'black', text: '서보의 갈색 선을 별도 전원의 - 단자에 연결하세요.' },
    { from: 'SERVO_SUPPLY.-', to: 'UNO.GND', color: 'black', text: '별도 전원의 - 단자를 아두이노 GND와 공통으로 묶으세요. 이 선이 없으면 서보가 신호를 알아듣지 못합니다.' },
  ]
}

export function relayFan(pin: string): Connection[] {
  return [
    { from: 'RELAY.IN', to: `UNO.${pin}`, color: 'orange', text: `릴레이 모듈의 IN을 ${pin}에 연결하세요.` },
    { from: 'RELAY.VCC', to: 'UNO.5V', color: 'red', text: '릴레이 모듈의 VCC를 아두이노 5V에 연결하세요.' },
    { from: 'RELAY.GND', to: 'UNO.GND', color: 'black', text: '릴레이 모듈의 GND를 아두이노 GND에 연결하세요.' },
    { from: 'FAN_SUPPLY.+', to: 'RELAY.COM', color: 'red', text: '팬 정격에 맞는 별도 5V 전원의 + 단자를 릴레이 COM에 연결하세요.' },
    { from: 'RELAY.NO', to: 'FAN.POSITIVE', color: 'purple', text: '릴레이 NO를 팬의 + 선에 연결하세요. 릴레이가 켜지면 COM과 NO가 붙습니다.' },
    { from: 'FAN.NEGATIVE', to: 'FAN_SUPPLY.-', color: 'black', text: '팬의 - 선을 별도 전원의 - 단자에 연결해 회로를 닫으세요.' },
  ]
}

/** 한 채널만 쓰는 모터 배선. 방향 입력 둘과 속도 입력 하나가 한 벌입니다. */
export function motorChannel(in1: string, in2: string, ena: string, channel = 'A'): Connection[] {
  return [
    { from: `DRIVER.IN${channel === 'A' ? '1' : '3'}`, to: `UNO.${in1}`, color: 'orange', text: `모터 드라이버 ${channel}채널의 첫 방향 입력을 ${in1}에 연결하세요.` },
    { from: `DRIVER.IN${channel === 'A' ? '2' : '4'}`, to: `UNO.${in2}`, color: 'orange', text: `${channel}채널의 두 번째 방향 입력을 ${in2}에 연결하세요. 방향 입력은 둘이 모두 있어야 합니다.` },
    { from: `DRIVER.EN${channel}`, to: `UNO.${ena}`, color: 'yellow', text: `속도를 정하는 EN${channel}를 ${ena}에 연결하세요.` },
  ]
}

export function motorSupply(): Connection[] {
  return [
    { from: 'BATTERY.+', to: 'DRIVER.VM', color: 'red', text: '모터 정격에 맞는 별도 전원의 + 단자를 드라이버 VM에 연결하세요.' },
    { from: 'BATTERY.-', to: 'DRIVER.GND', color: 'black', text: '별도 전원의 - 단자를 드라이버 GND에 연결하세요.' },
    { from: 'DRIVER.GND', to: 'UNO.GND', color: 'black', text: '드라이버 GND와 아두이노 GND를 공통으로 묶으세요. 이 선이 없으면 방향 신호가 전해지지 않습니다.' },
  ]
}
