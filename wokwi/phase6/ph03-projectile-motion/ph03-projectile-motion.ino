// @pin A4=A4
// @pin A5=A5
// @pin D7=D7
// @pin D6=D6
#include <Wire.h>
// 발사체의 비행시간과 포물선 운동
// @baud 9600
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 100;

const byte TRIG_PIN=7,ECHO_PIN=6;
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
void setup() {
  Serial.begin(9600);
  Wire.begin();
  mpuWrite(0x68,0x6B,0);
  pinMode(TRIG_PIN,OUTPUT);
  pinMode(ECHO_PIN,INPUT);
  Serial.println("time_ms,distance_m,acceleration_x_g");
}
void loop() {
  digitalWrite(TRIG_PIN,LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN,HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN,LOW);
  unsigned long us=pulseIn(ECHO_PIN,HIGH,30000);
  Serial.print(millis());
  Serial.print(',');
  Serial.print(us*0.000343f/2.0f,4);
  Serial.print(',');
  Serial.println(mpuRead16(0x68,0x3B)/16384.0f,5);
  delay(samplingIntervalMs);
}
