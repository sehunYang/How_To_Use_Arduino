/** 실제 시리얼 모니터에서 흔히 섞여 드는 줄을 탭이 어떻게 처리하는지 확인합니다. */
import { convertSerialTextToCsv } from '../src/lib/serialCsv'
import { collectNumericColumns } from '../src/lib/dataStats'

const cases: Array<{ name: string; text: string }> = [
  {
    name: '정상',
    text: 'time_ms,temperature_c\n0,21.5\n1000,21.7\n2000,21.9',
  },
  {
    name: '스케치가 이미 돌고 있을 때 시리얼 모니터를 열어 헤더를 놓친 경우',
    text: '3000,22.1\n4000,22.3\n5000,22.5',
  },
  {
    name: '첫 줄이 중간부터 잘린 경우',
    text: '00,21.5\ntime_ms,temperature_c\n1000,21.7\n2000,21.9',
  },
  {
    name: 'DS18B20 읽기 실패로 nan이 섞인 경우',
    text: 'time_ms,water_c\n0,21.5\n1000,nan\n2000,21.9\n3000,nan\n4000,22.0',
  },
  {
    name: 'HC-SR04 미수신 -1이 섞인 경우',
    text: 'time_ms,distance_m\n0,0.4210\n100,-1.0000\n200,0.4180',
  },
  {
    name: '센서 오류 메시지가 섞인 경우',
    text: 'time_ms,temperature_c\n0,21.5\n# BME280_ERROR\n1000,21.7',
  },
  {
    name: '보드가 재시작해 헤더가 다시 찍힌 경우',
    text: 'time_ms,temperature_c\n0,21.5\n1000,21.7\ntime_ms,temperature_c\n0,21.4\n1000,21.6',
  },
  {
    name: '전송 중 글자가 깨진 줄이 섞인 경우',
    text: 'time_ms,temperature_c\n0,21.5\n10⸮0,21.\n2000,21.9',
  },
]

for (const item of cases) {
  const result = convertSerialTextToCsv(item.text)
  console.log(`\n==== ${item.name}`)
  if (!result.ok) {
    console.log(`  ❌ ${result.error}`)
    continue
  }
  const numeric = collectNumericColumns(result.header, result.rows)
  console.log(`  ✅ ${result.dataRowCount}행 · 제외 ${result.excludedRows.length}행 · 숫자 열 ${numeric.map((column) => `${column.name}(${column.numericCount})`).join(', ')}`)
  for (const row of result.excludedRows) console.log(`     제외 ${row.lineNumber}번째 줄: ${row.reason}`)
}
