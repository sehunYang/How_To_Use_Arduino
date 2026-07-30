// @pin LIGHT_LEFT=A0
// @pin LIGHT_RIGHT=A1
// @pin LEFT_IN=D2
// @pin RIGHT_IN=D3
// @pin LEFT_PWM=D5
// @pin RIGHT_PWM=D6
// @baud 9600
const byte LDR_L=A0,LDR_R=A1,IN_L=2,IN_R=3,PWM_L=5,PWM_R=6;
// @tunable deadband
int deadband = 40;
void setup() {
  Serial.begin(9600);
  Serial.println("PHASE5_READY:light-follow-car");
  pinMode(IN_L,OUTPUT); pinMode(IN_R,OUTPUT);
  pinMode(PWM_L,OUTPUT); pinMode(PWM_R,OUTPUT);
  digitalWrite(IN_L,HIGH); digitalWrite(IN_R,HIGH);
}
void loop() {
  int left=analogRead(LDR_L), right=analogRead(LDR_R);
  int error=left-right;
  int correction=abs(error)<deadband ? 0 : constrain(error/2,-80,80);
  analogWrite(PWM_L,constrain(150-correction,0,255));
  analogWrite(PWM_R,constrain(150+correction,0,255));
  Serial.print("left="); Serial.print(left);
  Serial.print(", right="); Serial.print(right);
  Serial.print(", error="); Serial.println(error);
  delay(50);
}
