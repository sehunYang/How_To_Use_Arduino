// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// @pin ONE_WIRE=D4
// @baud 9600

LiquidCrystal_I2C lcd(0x27, 16, 2);
OneWire oneWire(4);
DallasTemperature probe(&oneWire);
// 화면을 새로 쓰는 간격입니다. 너무 짧으면 글자가 깜빡여 읽기 어렵습니다.
// @tunable refreshMs
int refreshMs = 1000;

void setup() {
  Serial.begin(9600);
  lcd.init();
  lcd.backlight();
  probe.begin();
  Serial.println("time_ms,temperature_c");
}

void loop() {
  probe.requestTemperatures();
  float celsius = probe.getTempCByIndex(0);

  // 자리를 지우지 않고 덮어쓰면 앞 값의 남은 글자가 붙어 25.5가 25.55처럼 보입니다.
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Water temp");
  lcd.setCursor(0, 1);
  lcd.print(celsius, 1);
  lcd.print(" C");

  Serial.print(millis());
  Serial.print(',');
  Serial.println(celsius, 2);
  delay(refreshMs);
}
