// @pin TRIG=D8
// @pin ECHO=D9
// @pin BUZZER=D3
// @pin LED=D4
// @baud 9600
const byte TRIG=8,ECHO=9,BUZZER=3,LED_PIN=4;
// @tunable warningDistanceCm
float warningDistanceCm = 60.0;
void setup() {
  Serial.begin(9600);
  Serial.println("PHASE5_READY:parking-alarm");
  pinMode(TRIG,OUTPUT);
  pinMode(ECHO,INPUT);
  pinMode(BUZZER,OUTPUT);
  pinMode(LED_PIN,OUTPUT);
}
void loop() {
  digitalWrite(TRIG,LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG,HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG,LOW);
  unsigned long us=pulseIn(ECHO,HIGH,30000);
  float cm=us ? us*0.0343/2.0 : NAN;
  bool warning=!isnan(cm) && cm<warningDistanceCm;
  digitalWrite(LED_PIN,warning);
  if(warning) tone(BUZZER,1200,80);
  else noTone(BUZZER);
  Serial.print("distance_cm=");
  Serial.println(cm,1);
  delay(warning ? constrain((int)(cm*8),80,500) : 500);
}
