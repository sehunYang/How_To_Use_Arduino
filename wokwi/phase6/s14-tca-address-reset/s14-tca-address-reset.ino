// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
// @baud 9600
// @pin RST0=D2
// @pin RST1=D3
const byte RST0=2,RST1=3;
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=1000;
bool present(byte address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission()==0;
}
void selectChannel(byte address,byte channel) {
  Wire.beginTransmission(address);
  Wire.write(1<<channel);
  Wire.endTransmission();
}
byte readChannels(byte address) {
  Wire.requestFrom(address,(byte)1);
  return Wire.available()?Wire.read():0xFF;
}
// 채널을 하나 열어 둔 뒤 RST에 LOW 펄스를 주고, 멀티플렉서가 다시 응답하면서
// 채널 선택이 0으로 지워질 때까지 걸린 시간을 마이크로초로 잽니다.
unsigned long recoverMicros(byte address,byte pin) {
  selectChannel(address,0);
  unsigned long start=micros();
  digitalWrite(pin,LOW);
  delayMicroseconds(10);
  digitalWrite(pin,HIGH);
  while(micros()-start<20000UL) {
    if(present(address)&&readChannels(address)==0)break;
  }
  return micros()-start;
}
void setup() {
  Serial.begin(9600);
  Wire.begin();
  pinMode(RST0,OUTPUT);
  pinMode(RST1,OUTPUT);
  digitalWrite(RST0,HIGH);
  digitalWrite(RST1,HIGH);
  Serial.println("time_ms,mux_0x70_recovery_us,mux_0x70_channels,mux_0x71_recovery_us,mux_0x71_channels");
}
void loop() {
  unsigned long recovery0=recoverMicros(0x70,RST0);
  byte channels0=readChannels(0x70);
  unsigned long recovery1=recoverMicros(0x71,RST1);
  byte channels1=readChannels(0x71);
  Serial.print(millis());
  Serial.print(',');
  Serial.print(recovery0);
  Serial.print(',');
  Serial.print(channels0);
  Serial.print(',');
  Serial.print(recovery1);
  Serial.print(',');
  Serial.println(channels1);
  delay(samplingIntervalMs);
}
