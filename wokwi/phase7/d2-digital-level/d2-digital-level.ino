#include <Wire.h>
#include <MPU6050.h>
#include <LiquidCrystal_I2C.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

MPU6050 imu;
LiquidCrystal_I2C lcd(0x27, 16, 2);
// 화면에 띄우기 전 평균 낼 표본 수입니다. 늘리면 값이 안정되지만 느려집니다.
// @tunable averageCount
int averageCount = 20;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  imu.initialize();
  lcd.init();
  lcd.backlight();
  Serial.println("time_ms,roll_deg,pitch_deg");
}

void loop() {
  long sx = 0, sy = 0, sz = 0;
  for (int i = 0; i < averageCount; i++) {
    int16_t ax, ay, az;
    imu.getAcceleration(&ax, &ay, &az);
    sx += ax;
    sy += ay;
    sz += az;
    delay(5);
  }
  float x = (float)sx / averageCount, y = (float)sy / averageCount, z = (float)sz / averageCount;
  // 중력이 어느 쪽으로 기울었는지로 각도를 냅니다. 움직이는 동안에는
  // 가속도가 섞여 들어와 이 계산이 성립하지 않습니다.
  float roll = atan2(y, z) * 180.0 / PI;
  float pitch = atan2(-x, sqrt(y * y + z * z)) * 180.0 / PI;

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Roll  ");
  lcd.print(roll, 1);
  lcd.setCursor(0, 1);
  lcd.print("Pitch ");
  lcd.print(pitch, 1);

  Serial.print(millis());
  Serial.print(',');
  Serial.print(roll, 2);
  Serial.print(',');
  Serial.println(pitch, 2);
}
