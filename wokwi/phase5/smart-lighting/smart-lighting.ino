// @pin PIR=D2
// @pin LIGHT=A0
// @pin RELAY=D7
// @baud 9600
const byte PIR_PIN=2,LIGHT_PIN=A0,RELAY_PIN=7;
// @tunable darkThreshold
int darkThreshold = 350;
unsigned long lastMotion=0;
void setup() {
  Serial.begin(9600);
  Serial.println("PHASE5_READY:smart-lighting");
  pinMode(PIR_PIN,INPUT); pinMode(RELAY_PIN,OUTPUT);
  digitalWrite(RELAY_PIN,LOW);
  delay(30000);
}
void loop() {
  int light=analogRead(LIGHT_PIN);
  if(digitalRead(PIR_PIN)==HIGH) lastMotion=millis();
  bool occupied=millis()-lastMotion<30000;
  bool lamp=occupied && light<darkThreshold;
  digitalWrite(RELAY_PIN,lamp ? HIGH : LOW);
  Serial.print("light_adc=");Serial.print(light);
  Serial.print(", occupied=");Serial.print(occupied);
  Serial.print(", lamp=");Serial.println(lamp);
  delay(250);
}
