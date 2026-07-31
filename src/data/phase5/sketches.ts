export const oneWireDriver = `const byte ONE_WIRE_PIN=2;
bool owReset() {
  pinMode(ONE_WIRE_PIN,OUTPUT);digitalWrite(ONE_WIRE_PIN,LOW);delayMicroseconds(480);
  pinMode(ONE_WIRE_PIN,INPUT_PULLUP);delayMicroseconds(70);
  bool present=!digitalRead(ONE_WIRE_PIN);delayMicroseconds(410);return present;
}
void owWriteBit(bool bitValue) {
  pinMode(ONE_WIRE_PIN,OUTPUT);digitalWrite(ONE_WIRE_PIN,LOW);
  if(bitValue){delayMicroseconds(6);pinMode(ONE_WIRE_PIN,INPUT_PULLUP);delayMicroseconds(64);}
  else{delayMicroseconds(60);pinMode(ONE_WIRE_PIN,INPUT_PULLUP);delayMicroseconds(10);}
}
bool owReadBit() {
  pinMode(ONE_WIRE_PIN,OUTPUT);digitalWrite(ONE_WIRE_PIN,LOW);delayMicroseconds(3);
  pinMode(ONE_WIRE_PIN,INPUT_PULLUP);delayMicroseconds(10);
  bool bitValue=digitalRead(ONE_WIRE_PIN);delayMicroseconds(53);return bitValue;
}
void owWriteByte(byte value){for(byte i=0;i<8;i++){owWriteBit(value&1);value>>=1;}}
byte owReadByte(){byte value=0;for(byte i=0;i<8;i++)if(owReadBit())value|=(1<<i);return value;}
void startAllTemperatures(){if(owReset()){owWriteByte(0xCC);owWriteByte(0x44);}}
float readOnlyTemperatureC(){
  if(!owReset())return NAN;owWriteByte(0xCC);owWriteByte(0xBE);
  int16_t raw=owReadByte();raw|=(int16_t)owReadByte()<<8;return raw/16.0;
}`

const oneWireSearchDriver = `${oneWireDriver}
byte lastDiscrepancy=0;bool lastDevice=false;byte romCode[8];
void owResetSearch(){lastDiscrepancy=0;lastDevice=false;}
bool owSearch(){
  if(lastDevice||!owReset())return false;owWriteByte(0xF0);
  byte bitNumber=1,lastZero=0,romByte=0,romMask=1;
  while(romByte<8){
    bool bitValue=owReadBit(), complement=owReadBit(), direction;
    if(bitValue&&complement)return false;
    if(bitValue!=complement)direction=bitValue;
    else{
      direction=bitNumber<lastDiscrepancy ? ((romCode[romByte]&romMask)>0) : bitNumber==lastDiscrepancy;
      if(!direction)lastZero=bitNumber;
    }
    if(direction)romCode[romByte]|=romMask;else romCode[romByte]&=~romMask;
    owWriteBit(direction);bitNumber++;romMask<<=1;
    if(romMask==0){romByte++;romMask=1;}
  }
  lastDiscrepancy=lastZero;if(lastDiscrepancy==0)lastDevice=true;return true;
}
float readAddressTemperatureC(const byte address[8]){
  if(!owReset())return NAN;owWriteByte(0x55);
  for(byte i=0;i<8;i++)owWriteByte(address[i]);
  owWriteByte(0xBE);int16_t raw=owReadByte();raw|=(int16_t)owReadByte()<<8;return raw/16.0;
}`

export const bme280Driver = `const byte BME=0x76;
uint16_t digT1,digP1;int16_t digT2,digT3,digP2,digP3,digP4,digP5,digP6,digP7,digP8,digP9;
byte digH1,digH3;int16_t digH2,digH4,digH5;int8_t digH6;int32_t tFine;
byte bmeRead8(byte reg){Wire.beginTransmission(BME);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(BME,(byte)1);return Wire.read();}
uint16_t bmeRead16LE(byte reg){uint16_t lo=bmeRead8(reg),hi=bmeRead8(reg+1);return lo|(hi<<8);}
int16_t bmeReadS16LE(byte reg){return (int16_t)bmeRead16LE(reg);}
uint32_t bmeRead20(byte reg){
  Wire.beginTransmission(BME);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(BME,(byte)3);
  byte msb=Wire.read();byte lsb=Wire.read();byte xlsb=Wire.read();
  return ((uint32_t)msb<<12)|((uint16_t)lsb<<4)|(xlsb>>4);
}
void bmeWrite8(byte reg,byte value){Wire.beginTransmission(BME);Wire.write(reg);Wire.write(value);Wire.endTransmission();}
bool bmeBegin(){
  if(bmeRead8(0xD0)!=0x60)return false;
  digT1=bmeRead16LE(0x88);digT2=bmeReadS16LE(0x8A);digT3=bmeReadS16LE(0x8C);
  digP1=bmeRead16LE(0x8E);digP2=bmeReadS16LE(0x90);digP3=bmeReadS16LE(0x92);
  digP4=bmeReadS16LE(0x94);digP5=bmeReadS16LE(0x96);digP6=bmeReadS16LE(0x98);
  digP7=bmeReadS16LE(0x9A);digP8=bmeReadS16LE(0x9C);digP9=bmeReadS16LE(0x9E);
  digH1=bmeRead8(0xA1);digH2=bmeReadS16LE(0xE1);digH3=bmeRead8(0xE3);
  byte e4=bmeRead8(0xE4),e5=bmeRead8(0xE5),e6=bmeRead8(0xE6);
  digH4=((int16_t)(int8_t)e4<<4)|(e5&15);
  digH5=((int16_t)(int8_t)e6<<4)|(e5>>4);digH6=(int8_t)bmeRead8(0xE7);
  bmeWrite8(0xF2,1);bmeWrite8(0xF4,0x27);bmeWrite8(0xF5,0xA0);return true;
}
float bmeTemperatureC(){
  int32_t adc=bmeRead20(0xFA);
  int32_t v1=((((adc>>3)-((int32_t)digT1<<1)))*digT2)>>11;
  int32_t v2=(((((adc>>4)-digT1)*((adc>>4)-digT1))>>12)*digT3)>>14;
  tFine=v1+v2;return ((tFine*5+128)>>8)/100.0;
}
float bmePressureHpa(){
  int64_t v1=(int64_t)tFine-128000,v2=v1*v1*digP6;
  v2+=((v1*digP5)<<17);v2+=((int64_t)digP4<<35);
  v1=((v1*v1*digP3)>>8)+((v1*digP2)<<12);
  v1=(((((int64_t)1<<47)+v1))*digP1)>>33;if(v1==0)return NAN;
  int64_t p=1048576-bmeRead20(0xF7);p=(((p<<31)-v2)*3125)/v1;
  v1=(digP9*(p>>13)*(p>>13))>>25;v2=(digP8*p)>>19;
  p=((p+v1+v2)>>8)+((int64_t)digP7<<4);return p/25600.0;
}
float bmeHumidity(){
  byte hMsb=bmeRead8(0xFD),hLsb=bmeRead8(0xFE);
  int32_t adc=((uint32_t)hMsb<<8)|hLsb;
  int32_t v=tFine-76800;
  v=(((((adc<<14)-((int32_t)digH4<<20)-((int32_t)digH5*v))+16384)>>15)*
    (((((((v*digH6)>>10)*(((v*digH3)>>11)+32768))>>10)+2097152)*digH2+8192)>>14));
  v-=(((((v>>15)*(v>>15))>>7)*digH1)>>4);v=constrain(v,0,419430400);
  return (v>>12)/1024.0;
}`

export const p1Sketch = `#include <Wire.h>
#include <MPU6050.h>
// @pin SDA=A4
// @pin SCL=A5
// @baud 115200
MPU6050 imu;
// @tunable samplingIntervalMs
const unsigned long samplingIntervalMs = 10;
void setup() {
  Serial.begin(115200); Wire.begin(); imu.initialize();
  Serial.println("time_ms,ax_mps2");
}
void loop() {
  static unsigned long last = 0;
  if (millis() - last < samplingIntervalMs) return;
  last = millis();
  int16_t ax, ay, az; imu.getAcceleration(&ax, &ay, &az);
  Serial.print(last); Serial.print(',');
  Serial.println(ax * 9.80665 / 16384.0, 4);
}`

export const p2Sketch = `#include <Wire.h>
#include <MPU6050.h>
// @pin SDA=A4
// @pin SCL=A5
// @baud 115200
MPU6050 imu;
// @tunable samplingIntervalMs
const unsigned long samplingIntervalMs = 20;
void setup() {
  Serial.begin(115200); Wire.begin(); imu.initialize();
  Serial.println("time_ms,ax,ay,az,g_norm");
}
void loop() {
  static unsigned long last = 0;
  if (millis() - last < samplingIntervalMs) return;
  last = millis();
  int16_t ax, ay, az; imu.getAcceleration(&ax, &ay, &az);
  float x=ax/16384.0, y=ay/16384.0, z=az/16384.0;
  Serial.print(last); Serial.print(','); Serial.print(x,4); Serial.print(',');
  Serial.print(y,4); Serial.print(','); Serial.print(z,4); Serial.print(',');
  Serial.println(sqrt(x*x+y*y+z*z),4);
}`

export const p3Sketch = `// @pin TRIG=D9
// @pin ECHO=D10
// @baud 9600
const byte TRIG=9, ECHO=10;
// @tunable samplingIntervalMs
const unsigned long samplingIntervalMs = 60;
float distanceM() {
  digitalWrite(TRIG,LOW); delayMicroseconds(2);
  digitalWrite(TRIG,HIGH); delayMicroseconds(10); digitalWrite(TRIG,LOW);
  unsigned long us=pulseIn(ECHO,HIGH,30000);
  return us ? us*0.0001715 : NAN;
}
void setup() {
  Serial.begin(9600); pinMode(TRIG,OUTPUT); pinMode(ECHO,INPUT);
  Serial.println("time_ms,distance_m");
}
void loop() {
  static unsigned long last=0;
  if (millis()-last<samplingIntervalMs) return;
  last=millis(); Serial.print(last); Serial.print(','); Serial.println(distanceM(),4);
}`

export const p4Sketch = `#include <Wire.h>
#include <MPU6050.h>
// @pin SDA=A4
// @pin SCL=A5
// @pin TRIG=D9
// @pin ECHO=D10
// @baud 9600
MPU6050 imu; const byte TRIG=9, ECHO=10;
// @tunable samplingIntervalMs
const unsigned long samplingIntervalMs = 60;
float distanceM() {
  digitalWrite(TRIG,LOW); delayMicroseconds(2); digitalWrite(TRIG,HIGH);
  delayMicroseconds(10); digitalWrite(TRIG,LOW);
  unsigned long us=pulseIn(ECHO,HIGH,30000); return us ? us*0.0001715 : NAN;
}
void setup() {
  Serial.begin(9600); Wire.begin(); imu.initialize();
  pinMode(TRIG,OUTPUT); pinMode(ECHO,INPUT);
  Serial.println("time_ms,distance_m,ax_mps2");
}
void loop() {
  static unsigned long last=0; if(millis()-last<samplingIntervalMs)return;
  last=millis(); int16_t ax,ay,az; imu.getAcceleration(&ax,&ay,&az);
  Serial.print(last); Serial.print(','); Serial.print(distanceM(),4); Serial.print(',');
  Serial.println(ax*9.80665/16384.0,4);
}`

export const p5Sketch = `#include <Wire.h>
#include <MPU6050.h>
// @pin SDA=A4
// @pin SCL=A5
// @baud 115200
MPU6050 imu;
// @tunable samplingIntervalMs
const unsigned long samplingIntervalMs = 20;
void setup() {
  Serial.begin(115200); Wire.begin(); imu.initialize();
  Serial.println("time_ms,along_mps2,tilt_deg");
}
void loop() {
  static unsigned long last=0; if(millis()-last<samplingIntervalMs)return;
  last=millis(); int16_t ax,ay,az; imu.getAcceleration(&ax,&ay,&az);
  float x=ax/16384.0, y=ay/16384.0, z=az/16384.0;
  float tilt=atan2(x,sqrt(y*y+z*z))*180.0/PI;
  Serial.print(last); Serial.print(','); Serial.print(x*9.80665,4);
  Serial.print(','); Serial.println(tilt,2);
}`

export const p6Sketch = `// @pin HALL=A0
// @baud 9600
const byte HALL=A0;
// @tunable zeroAdc
int zeroAdc = 512;
void setup() {
  Serial.begin(9600);
  Serial.println("time_ms,raw,signed_relative_field");
}
void loop() {
  int raw=analogRead(HALL);
  Serial.print(millis()); Serial.print(','); Serial.print(raw); Serial.print(',');
  Serial.println(raw-zeroAdc);
  delay(50);
}`

export const p7Sketch = `#include <Wire.h>
#include <Adafruit_TSL2591.h>
// @pin SDA=A4
// @pin SCL=A5
// @baud 9600
Adafruit_TSL2591 tsl(2591);
const byte INA=0x40;
// @tunable panelAreaCm2
float panelAreaCm2 = 100.0;
void inaWrite(byte reg,uint16_t value){
  Wire.beginTransmission(INA);Wire.write(reg);Wire.write(value>>8);Wire.write(value);Wire.endTransmission();
}
uint16_t inaRead(byte reg){
  Wire.beginTransmission(INA);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(INA,(byte)2);
  byte high=Wire.read();byte low=Wire.read(); // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return ((uint16_t)high<<8)|low;
}
void setup() {
  Serial.begin(9600); Wire.begin(); inaWrite(0x05,4096); tsl.begin();
  Serial.println("time_ms,voltage_v,current_ma,power_mw,lux,power_density_mw_cm2");
}
void loop() {
  float voltage=(inaRead(0x02)>>3)*0.004;
  float current=(int16_t)inaRead(0x04)*0.1;
  float power=inaRead(0x03)*2.0;
  uint32_t lum=tsl.getFullLuminosity();
  float lux=tsl.calculateLux(lum & 0xffff, lum >> 16);
  Serial.print(millis()); Serial.print(','); Serial.print(voltage,3); Serial.print(',');
  Serial.print(current,3); Serial.print(','); Serial.print(power,3); Serial.print(',');
  Serial.print(lux,2); Serial.print(',');
  Serial.println(panelAreaCm2>0 ? power/panelAreaCm2 : 0,4);
  delay(250);
}`

export const p8Sketch = `#include <Wire.h>
#include <Adafruit_TSL2591.h>
// @pin SDA=A4
// @pin SCL=A5
// @pin TRIG=D9
// @pin ECHO=D10
// @baud 9600
const byte TRIG=9,ECHO=10;
Adafruit_TSL2591 tsl(2591);
// @tunable sampleCount
const byte sampleCount = 5;
float lightLux() {
  uint32_t lum=tsl.getFullLuminosity();
  return tsl.calculateLux(lum & 0xffff, lum >> 16);
}
float distanceM() {
  digitalWrite(TRIG,LOW);delayMicroseconds(2);digitalWrite(TRIG,HIGH);
  delayMicroseconds(10);digitalWrite(TRIG,LOW);
  return pulseIn(ECHO,HIGH,30000)*0.0001715;
}
void setup() {
  Serial.begin(9600); Wire.begin(); tsl.begin();
  pinMode(TRIG,OUTPUT);pinMode(ECHO,INPUT);
  Serial.println("time_ms,distance_m,mean_lux,d2_times_lux");
}
void loop() {
  float d=distanceM();
  float sum=0;
  for(byte i=0;i<sampleCount;i++){sum+=lightLux();delay(120);}
  float light=sum/sampleCount;
  Serial.print(millis());Serial.print(',');
  Serial.print(d,4);Serial.print(',');Serial.print(light,2);Serial.print(',');
  Serial.println(light*d*d,3); delay(300);
}`

export const e1Sketch = `#include <Wire.h>
// @pin SDA=A4
// @pin SCL=A5
// @pin RELAY=D7
// @baud 9600
${bme280Driver}
const byte RELAY=7;
// @tunable humidityOnPercent
float humidityOnPercent = 70.0;
void setup() {
  Serial.begin(9600); Wire.begin(); bmeBegin();
  pinMode(RELAY,OUTPUT); digitalWrite(RELAY,LOW);
  Serial.println("temperature_c,humidity_percent,fan");
}
void loop() {
  float t=bmeTemperatureC(), h=bmeHumidity();
  bool on=h>=humidityOnPercent || t>=30.0; digitalWrite(RELAY,on);
  Serial.print(t,2);Serial.print(',');Serial.print(h,2);Serial.print(',');
  Serial.println(on ? 1 : 0); delay(1000);
}`

export const e2Sketch = `// @pin ONE_WIRE=D2
// @baud 9600
${oneWireDriver}
// @tunable samplingIntervalMs
const unsigned long samplingIntervalMs = 1000;
void setup() {
  Serial.begin(9600); Serial.println("time_s,temperature_c");
}
void loop() {
  startAllTemperatures();delay(750);
  Serial.print(millis()/1000.0,1); Serial.print(',');
  Serial.println(readOnlyTemperatureC(),3);
  delay(samplingIntervalMs);
}`

export const e3Sketch = `// @pin ONE_WIRE=D2
// @baud 9600
${oneWireDriver}
// @tunable ambientTemperatureC
float ambientTemperatureC = 22.0;
void setup() {
  Serial.begin(9600);
  Serial.println("time_s,temperature_c,excess_temperature_c");
}
void loop() {
  startAllTemperatures();delay(750);float t=readOnlyTemperatureC();
  Serial.print(millis()/1000.0,1);Serial.print(',');Serial.print(t,3);
  Serial.print(',');Serial.println(t-ambientTemperatureC,3); delay(1000);
}`

export const e4Sketch = `#include <Wire.h>
// @pin SDA=A4
// @pin SCL=A5
// @baud 9600
${bme280Driver}
// @tunable seaLevelPressureHpa
float seaLevelPressureHpa = 1013.25;
void setup() {
  Serial.begin(9600); Wire.begin(); bmeBegin();
  Serial.println("time_min,pressure_hpa,relative_altitude_m");
}
void loop() {
  bmeTemperatureC();float p=bmePressureHpa();
  float altitude=44330.0*(1.0-pow(p/seaLevelPressureHpa,0.1903));
  Serial.print(millis()/60000.0,2);Serial.print(',');Serial.print(p,2);
  Serial.print(',');Serial.println(altitude,2);delay(60000);
}`

export const e5Sketch = `#include <Wire.h>
#include <Adafruit_TSL2591.h>
// @pin SDA=A4
// @pin SCL=A5
// @baud 9600
const byte MUX=0x70;
Adafruit_TSL2591 tsl(2591);
// @tunable channelSettleMs
const unsigned int channelSettleMs = 25;
void selectChannel(byte channel) {
  Wire.beginTransmission(MUX);Wire.write(1<<channel);Wire.endTransmission();
  delay(channelSettleMs);
}
float readLight() {
  uint32_t lum=tsl.getFullLuminosity();
  return tsl.calculateLux(lum & 0xffff, lum >> 16);
}
void setup() {
  Serial.begin(9600);Wire.begin();
  for(byte channel=0;channel<3;channel++){selectChannel(channel);tsl.begin();}
  Serial.println("time_ms,position,lux");
}
void loop() {
  for(byte channel=0;channel<3;channel++){
    selectChannel(channel);Serial.print(millis());Serial.print(',');
    Serial.print(channel);Serial.print(',');Serial.println(readLight());
  }
  delay(500);
}`

export const e6Sketch = `// @pin ONE_WIRE=D2
// @baud 9600
${oneWireSearchDriver}
// @tunable sensorCount
const byte sensorCount = 3;
void setup() {
  Serial.begin(9600);Serial.println("time_ms,index,temperature_c");
}
void loop() {
  startAllTemperatures();delay(750);owResetSearch();
  byte index=0;
  while(index<sensorCount && owSearch()){
    byte address[8];for(byte i=0;i<8;i++)address[i]=romCode[i];
    Serial.print(millis());Serial.print(',');Serial.print(index);Serial.print(',');
    Serial.println(readAddressTemperatureC(address),3);index++;
  }
  delay(1000);
}`
