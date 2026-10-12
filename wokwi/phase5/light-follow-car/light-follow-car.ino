// @pin LIGHT_LEFT=A0
// @pin LIGHT_RIGHT=A1
// @pin LEFT_IN1=D2
// @pin LEFT_IN2=D4
// @pin RIGHT_IN3=D3
// @pin RIGHT_IN4=D7
// @pin LEFT_PWM=D5
// @pin RIGHT_PWM=D6
// @baud 9600
const byte LDR_L=A0,LDR_R=A1,IN_L1=2,IN_L2=4,IN_R3=3,IN_R4=7,PWM_L=5,PWM_R=6;
// @tunable deadband
int deadband = 40;
void setup() {
  Serial.begin(9600);
  pinMode(IN_L1,OUTPUT);
  pinMode(IN_L2,OUTPUT);
  pinMode(IN_R3,OUTPUT);
  pinMode(IN_R4,OUTPUT);
  pinMode(PWM_L,OUTPUT);
  pinMode(PWM_R,OUTPUT);
  // L298N은 모터 한 개당 방향 입력이 두 개입니다. 두 입력을 HIGH/LOW로
  // 함께 정해야 회전 방향이 확정됩니다.
  digitalWrite(IN_L1,HIGH);
  digitalWrite(IN_L2,LOW);
  digitalWrite(IN_R3,HIGH);
  digitalWrite(IN_R4,LOW);
  Serial.println("time_ms,left_adc,right_adc,error");
}
void loop() {
  int left=analogRead(LDR_L), right=analogRead(LDR_R);
  int error=left-right;
  int correction=abs(error)<deadband ? 0 : constrain(error/2,-80,80);
  analogWrite(PWM_L,constrain(150-correction,0,255));
  analogWrite(PWM_R,constrain(150+correction,0,255));
  Serial.print(millis());
  Serial.print(',');
  Serial.print(left);
  Serial.print(',');
  Serial.print(right);
  Serial.print(',');
  Serial.println(error);
  delay(50);
}
