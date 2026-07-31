// @pin ONE_WIRE=D2
// @baud 9600
const byte ONE_WIRE_PIN=2;
bool owReset() {
  pinMode(ONE_WIRE_PIN,OUTPUT);
  digitalWrite(ONE_WIRE_PIN,LOW);
  delayMicroseconds(480);
  pinMode(ONE_WIRE_PIN,INPUT_PULLUP);
  delayMicroseconds(70);
  bool present=!digitalRead(ONE_WIRE_PIN);
  delayMicroseconds(410);
  return present;
}
void owWriteBit(bool bitValue) {
  pinMode(ONE_WIRE_PIN,OUTPUT);
  digitalWrite(ONE_WIRE_PIN,LOW);
  if(bitValue) {
    delayMicroseconds(6);
    pinMode(ONE_WIRE_PIN,INPUT_PULLUP);
    delayMicroseconds(64);
  }
  else {
    delayMicroseconds(60);
    pinMode(ONE_WIRE_PIN,INPUT_PULLUP);
    delayMicroseconds(10);
  }
}
bool owReadBit() {
  pinMode(ONE_WIRE_PIN,OUTPUT);
  digitalWrite(ONE_WIRE_PIN,LOW);
  delayMicroseconds(3);
  pinMode(ONE_WIRE_PIN,INPUT_PULLUP);
  delayMicroseconds(10);
  bool bitValue=digitalRead(ONE_WIRE_PIN);
  delayMicroseconds(53);
  return bitValue;
}
void owWriteByte(byte value) {
  for(byte i=0;i<8;i++) {
    owWriteBit(value&1);
    value>>=1;
  }
}
byte owReadByte() {
  byte value=0;
  for(byte i=0;i<8;i++)if(owReadBit())value|=(1<<i);
  return value;
}
void startAllTemperatures() {
  if(owReset()) {
    owWriteByte(0xCC);
    owWriteByte(0x44);
  }
}
float readOnlyTemperatureC() {
  if(!owReset())return NAN;
  owWriteByte(0xCC);
  owWriteByte(0xBE);
  int16_t raw=owReadByte();
  raw|=(int16_t)owReadByte()<<8;
  return raw/16.0;
}
byte lastDiscrepancy=0;
bool lastDevice=false;
byte romCode[8];
void owResetSearch() {
  lastDiscrepancy=0;
  lastDevice=false;
}
bool owSearch() {
  if(lastDevice||!owReset())return false;
  owWriteByte(0xF0);
  byte bitNumber=1,lastZero=0,romByte=0,romMask=1;
  while(romByte<8) {
    bool bitValue=owReadBit(), complement=owReadBit(), direction;
    if(bitValue&&complement)return false;
    if(bitValue!=complement)direction=bitValue;
    else {
      direction=bitNumber<lastDiscrepancy ? ((romCode[romByte]&romMask)>0) : bitNumber==lastDiscrepancy;
      if(!direction)lastZero=bitNumber;
    }
    if(direction)romCode[romByte]|=romMask;
    else romCode[romByte]&=~romMask;
    owWriteBit(direction);
    bitNumber++;
    romMask<<=1;
    if(romMask==0) {
      romByte++;
      romMask=1;
    }
  }
  lastDiscrepancy=lastZero;
  if(lastDiscrepancy==0)lastDevice=true;
  return true;
}
float readAddressTemperatureC(const byte address[8]) {
  if(!owReset())return NAN;
  owWriteByte(0x55);
  for(byte i=0;i<8;i++)owWriteByte(address[i]);
  owWriteByte(0xBE);
  int16_t raw=owReadByte();
  raw|=(int16_t)owReadByte()<<8;
  return raw/16.0;
}
// @tunable sensorCount
const byte sensorCount = 3;
void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:e6-multi-point-temperature");
  Serial.println("time_ms,index,temperature_c");
}
void loop() {
  startAllTemperatures();
  delay(750);
  owResetSearch();
  byte index=0;
  while(index<sensorCount && owSearch()) {
    byte address[8];
    for(byte i=0;i<8;i++)address[i]=romCode[i];
    Serial.print(millis());
    Serial.print(',');
    Serial.print(index);
    Serial.print(',');
    Serial.println(readAddressTemperatureC(address),3);
    index++;
  }
  delay(1000);
}
