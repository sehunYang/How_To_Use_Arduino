#include <OneWire.h>
#include <DallasTemperature.h>

// @pin ONE_WIRE=D4
// @pin BUZZER=D8
// @pin LED=D9
// @baud 9600

OneWire oneWire(4);
DallasTemperature probe(&oneWire);
const byte BUZZER_PIN = 8, LED_PIN = 9;
// 경보를 울릴 온도입니다. 경보를 푸는 온도는 이보다 1 °C 낮게 둡니다.
// @tunable alarmC
float alarmC = 30.0;

bool alarming = false;

void setup() {
  Serial.begin(9600);
  probe.begin();
  probe.setResolution(12);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("time_ms,temperature_c,alarm_state");
}

void loop() {
  probe.requestTemperatures();
  float celsius = probe.getTempCByIndex(0);

  // 울리는 기준과 그치는 기준을 1 °C 벌려 둡니다. 같은 값으로 두면 온도가
  // 그 언저리에서 흔들릴 때 부저가 따다닥 끊어져 울립니다.
  if (!alarming && celsius > alarmC) alarming = true;
  if (alarming && celsius < alarmC - 1.0) alarming = false;

  digitalWrite(LED_PIN, alarming ? HIGH : LOW);
  if (alarming) tone(BUZZER_PIN, 880);
  else noTone(BUZZER_PIN);

  Serial.print(millis());
  Serial.print(',');
  Serial.print(celsius, 2);
  Serial.print(',');
  Serial.println(alarming ? 1 : 0);
  delay(1000);
}
