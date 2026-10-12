// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

// @pin TRIG=D7
// @pin ECHO=D6
// @pin SERVO=D9
// @baud 9600

const byte TRIG_PIN = 7, ECHO_PIN = 6;
LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo door;
// 한 층의 높이입니다. 모형의 실제 층 간격을 자로 재어 넣으세요.
// @tunable floorHeightCm
float floorHeightCm = 8.0;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  lcd.init();
  lcd.backlight();
  door.attach(9);
  door.write(0);
  Serial.println("time_ms,distance_cm,floor_index,commanded_deg");
}

long readCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000);
  return us == 0 ? -1 : (long)(us / 58);
}

void loop() {
  long cm = readCm();
  // 거리를 층 높이로 나눠 반올림하면 층 번호가 됩니다. 층 간격보다 센서의
  // 흔들림이 크면 이 나눗셈이 층을 잘못 짚습니다.
  int floorIndex = cm > 0 ? (int)((cm + floorHeightCm / 2) / floorHeightCm) : -1;
  int angle = (cm > 0 && cm < floorHeightCm / 2) ? 90 : 0;
  door.write(angle);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Floor ");
  lcd.print(floorIndex);
  lcd.setCursor(0, 1);
  lcd.print(cm);
  lcd.print(" cm");

  Serial.print(millis());
  Serial.print(',');
  Serial.print(cm);
  Serial.print(',');
  Serial.print(floorIndex);
  Serial.print(',');
  Serial.println(angle);
  delay(300);
}
