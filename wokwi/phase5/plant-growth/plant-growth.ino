#include <Wire.h>
#include <Adafruit_TSL2591.h>
// @pin SDA=A4
// @pin SCL=A5
// @baud 9600
Adafruit_TSL2591 light(2591);
const byte BME=0x76;
uint16_t T1; int16_t T2,T3,H2,H4,H5; byte H1,H3; int8_t H6;
float tFine=0;
// @tunable loggingIntervalMs
const unsigned long loggingIntervalMs = 5000;
byte read8(byte reg) {
  Wire.beginTransmission(BME); Wire.write(reg); Wire.endTransmission(false);
  Wire.requestFrom(BME,(byte)1); return Wire.read();
}
uint16_t read16LE(byte reg) {
  byte lo=read8(reg), hi=read8(reg+1); return ((uint16_t)hi<<8)|lo;
}
int16_t readS16LE(byte reg) { return (int16_t)read16LE(reg); }
void write8(byte reg,byte value) {
  Wire.beginTransmission(BME); Wire.write(reg); Wire.write(value); Wire.endTransmission();
}
void beginBme() {
  T1=read16LE(0x88); T2=readS16LE(0x8A); T3=readS16LE(0x8C);
  H1=read8(0xA1); H2=readS16LE(0xE1); H3=read8(0xE3);
  H4=(int16_t)((read8(0xE4)<<4)|(read8(0xE5)&0x0f));
  H5=(int16_t)((read8(0xE6)<<4)|(read8(0xE5)>>4)); H6=(int8_t)read8(0xE7);
  if(H4&0x0800) H4|=0xf000; if(H5&0x0800) H5|=0xf000;
  write8(0xF2,1); write8(0xF4,0x27);
}
float temperatureC() {
  byte a=read8(0xFA),b=read8(0xFB),c=read8(0xFC);
  long raw=((long)a<<12)|((long)b<<4)|(c>>4);
  float v1=(raw/16384.0-T1/1024.0)*T2;
  float v2=(raw/131072.0-T1/8192.0);
  v2=v2*v2*T3; tFine=v1+v2; return tFine/5120.0;
}
float humidityPct() {
  long raw=((long)read8(0xFD)<<8)|read8(0xFE);
  float h=tFine-76800.0;
  h=(raw-(H4*64.0+H5/16384.0*h))*(H2/65536.0*(1.0+H6/67108864.0*h*(1.0+H3/67108864.0*h)));
  h=h*(1.0-H1*h/524288.0); return constrain(h,0.0,100.0);
}
void setup() {
  Serial.begin(9600);
  Serial.println("PHASE5_READY:plant-growth"); Wire.begin();
  if (!light.begin()) Serial.println("TSL2591_ERROR");
  if (read8(0xD0)!=0x60) Serial.println("BME280_ERROR"); else beginBme();
  light.setGain(TSL2591_GAIN_LOW);
  light.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  Serial.println("time_ms,lux,temperature_c,humidity_pct");
}
void loop() {
  uint32_t raw = light.getFullLuminosity();
  uint16_t ir = raw >> 16, full = raw & 0xffff;
  float temperature=temperatureC();
  Serial.print(millis()); Serial.print(',');
  Serial.print(light.calculateLux(full, ir), 2); Serial.print(',');
  Serial.print(temperature, 2); Serial.print(',');
  Serial.println(humidityPct(), 2);
  delay(loggingIntervalMs);
}
