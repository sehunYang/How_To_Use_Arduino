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
// @tunable samplingIntervalMs
const unsigned long samplingIntervalMs = 1000;
void setup() {
  Serial.begin(9600);
  Serial.println("PHASE5_READY:e2-reaction-temperature");
  Serial.println("time_s,temperature_c");
}
void loop() {
  startAllTemperatures();
  delay(750);
  Serial.print(millis()/1000.0,1);
  Serial.print(',');
  Serial.println(readOnlyTemperatureC(),3);
  delay(samplingIntervalMs);
}
