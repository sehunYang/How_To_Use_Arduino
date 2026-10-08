// @pin A4=A4
// @pin A5=A5
// @pin A1=A1
#include <Wire.h>
// 회전체 각속도와 RPM 비교
// @baud 9600
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 100;

int16_t mpuRead16(byte address,byte reg) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(address,(byte)2);
  byte high=Wire.read();
  byte low=Wire.read();
  return (int16_t)(((uint16_t)high<<8)|low);
}
void mpuWrite(byte address,byte reg,byte value) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}
const byte HALL_PIN=A1;
// 자석을 대었을 때 값이 '내려가는' 극이 센서를 향해야 펄스가 세어집니다.
// 기준값은 자석 없이 읽은 값(대개 512 부근)에 맞춰 조절하세요.
const int MAGNET_THRESHOLD=400,RELEASE_THRESHOLD=500;
unsigned long pulseCount=0,lastPulseUs=0,lastIntervalUs=0;
bool magnetDetected=false;
int hallRaw=0;
void pollHall() {
  hallRaw=analogRead(HALL_PIN);
  if(!magnetDetected&&hallRaw<=MAGNET_THRESHOLD) {
    magnetDetected=true;
    unsigned long now=micros();
    if(lastPulseUs)lastIntervalUs=now-lastPulseUs;
    lastPulseUs=now;
    pulseCount++;
  }
  else if(magnetDetected&&hallRaw>=RELEASE_THRESHOLD)magnetDetected=false;
}
void pollHallFor(unsigned long durationMs) {
  unsigned long start=millis();
  do {
    pollHall();
  }
  while(millis()-start<durationMs);
}
void setup() {
  Serial.begin(9600);
  Wire.begin();
  mpuWrite(0x68,0x6B,0);
  Serial.println("time_ms,gyro_z_dps,hall_raw,pulse_count,pulse_interval_us");
}
void loop() {
  // 표본 간격 내내 홀 신호를 계속 살펴 자석 통과 펄스를 놓치지 않습니다.
  pollHallFor(samplingIntervalMs);
  float gyroZ=mpuRead16(0x68,0x47)/131.0f;
  Serial.print(millis());
  Serial.print(',');
  Serial.print(gyroZ,3);
  Serial.print(',');
  Serial.print(hallRaw);
  Serial.print(',');
  Serial.print(pulseCount);
  Serial.print(',');
  Serial.println(lastIntervalUs);
}
