#include <Wire.h>
// @pin SDA=A4
// @pin SCL=A5
// @baud 9600
const byte BME=0x76;
uint16_t digT1,digP1;
int16_t digT2,digT3,digP2,digP3,digP4,digP5,digP6,digP7,digP8,digP9;
byte digH1,digH3;
int16_t digH2,digH4,digH5;
int8_t digH6;
int32_t tFine;
byte bmeRead8(byte reg) {
  Wire.beginTransmission(BME);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(BME,(byte)1);
  return Wire.read();
}
uint16_t bmeRead16LE(byte reg) {
  uint16_t lo=bmeRead8(reg),hi=bmeRead8(reg+1);
  return lo|(hi<<8);
}
int16_t bmeReadS16LE(byte reg) {
  return (int16_t)bmeRead16LE(reg);
}
uint32_t bmeRead20(byte reg) {
  Wire.beginTransmission(BME);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(BME,(byte)3);
  return ((uint32_t)Wire.read()<<12)|((uint16_t)Wire.read()<<4)|(Wire.read()>>4);
}
void bmeWrite8(byte reg,byte value) {
  Wire.beginTransmission(BME);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}
bool bmeBegin() {
  if(bmeRead8(0xD0)!=0x60)return false;
  digT1=bmeRead16LE(0x88);
  digT2=bmeReadS16LE(0x8A);
  digT3=bmeReadS16LE(0x8C);
  digP1=bmeRead16LE(0x8E);
  digP2=bmeReadS16LE(0x90);
  digP3=bmeReadS16LE(0x92);
  digP4=bmeReadS16LE(0x94);
  digP5=bmeReadS16LE(0x96);
  digP6=bmeReadS16LE(0x98);
  digP7=bmeReadS16LE(0x9A);
  digP8=bmeReadS16LE(0x9C);
  digP9=bmeReadS16LE(0x9E);
  digH1=bmeRead8(0xA1);
  digH2=bmeReadS16LE(0xE1);
  digH3=bmeRead8(0xE3);
  digH4=((int16_t)(int8_t)bmeRead8(0xE4)<<4)|(bmeRead8(0xE5)&15);
  digH5=((int16_t)(int8_t)bmeRead8(0xE6)<<4)|(bmeRead8(0xE5)>>4);
  digH6=(int8_t)bmeRead8(0xE7);
  bmeWrite8(0xF2,1);
  bmeWrite8(0xF4,0x27);
  bmeWrite8(0xF5,0xA0);
  return true;
}
float bmeTemperatureC() {
  int32_t adc=bmeRead20(0xFA);
  int32_t v1=((((adc>>3)-((int32_t)digT1<<1)))*digT2)>>11;
  int32_t v2=(((((adc>>4)-digT1)*((adc>>4)-digT1))>>12)*digT3)>>14;
  tFine=v1+v2;
  return ((tFine*5+128)>>8)/100.0;
}
float bmePressureHpa() {
  int64_t v1=(int64_t)tFine-128000,v2=v1*v1*digP6;
  v2+=((v1*digP5)<<17);
  v2+=((int64_t)digP4<<35);
  v1=((v1*v1*digP3)>>8)+((v1*digP2)<<12);
  v1=(((((int64_t)1<<47)+v1))*digP1)>>33;
  if(v1==0)return NAN;
  int64_t p=1048576-bmeRead20(0xF7);
  p=(((p<<31)-v2)*3125)/v1;
  v1=(digP9*(p>>13)*(p>>13))>>25;
  v2=(digP8*p)>>19;
  p=((p+v1+v2)>>8)+((int64_t)digP7<<4);
  return p/25600.0;
}
float bmeHumidity() {
  int32_t adc=((uint32_t)bmeRead8(0xFD)<<8)|bmeRead8(0xFE);
  int32_t v=tFine-76800;
  v=(((((adc<<14)-((int32_t)digH4<<20)-((int32_t)digH5*v))+16384)>>15)*
  (((((((v*digH6)>>10)*(((v*digH3)>>11)+32768))>>10)+2097152)*digH2+8192)>>14));
  v-=(((((v>>15)*(v>>15))>>7)*digH1)>>4);
  v=constrain(v,0,419430400);
  return (v>>12)/1024.0;
}
// @tunable seaLevelPressureHpa
float seaLevelPressureHpa = 1013.25;
void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:e4-weather-pressure");
  Wire.begin();
  bmeBegin();
  Serial.println("time_min,pressure_hpa,relative_altitude_m");
}
void loop() {
  bmeTemperatureC();
  float p=bmePressureHpa();
  float altitude=44330.0*(1.0-pow(p/seaLevelPressureHpa,0.1903));
  Serial.print(millis()/60000.0,2);
  Serial.print(',');
  Serial.print(p,2);
  Serial.print(',');
  Serial.println(altitude,2);
  delay(60000);
}
