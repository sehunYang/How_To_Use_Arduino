// @pin PIR=D2
// @pin LIGHT=A0
// @pin RELAY=D7
// @baud 9600
const byte PIR_PIN=2,LIGHT_PIN=A0,RELAY_PIN=7;
// @tunable darkThreshold
int darkThreshold = 350;
// 끄는 기준은 켜는 기준보다 높게 두어(히스테리시스) 조명 빛이 CDS로
// 되먹임되어 생기는 빠른 반복 동작을 막습니다.
int brightThreshold = 450;
// 조명 유지 시간 실험은 이 값을 10000, 30000, 60000으로 바꿔 가며 반복하세요.
unsigned long holdOnMs = 30000;
unsigned long lastMotion=0,lastSwitch=0;
// 아직 아무도 감지하지 않았을 때 lastMotion은 0입니다. 이 표시가 없으면 유지 시간을
// 60000으로 늘렸을 때 안정화 직후 30초 동안 빈 방도 사람이 있는 것으로 판정됩니다.
bool motionSeen=false;
bool lamp=false;
void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:smart-lighting");
  pinMode(PIR_PIN,INPUT);
  pinMode(RELAY_PIN,OUTPUT);
  digitalWrite(RELAY_PIN,LOW);
  // PIR 안정화를 기다리는 동안 시리얼 모니터를 연 학생이 헤더를 놓치지 않도록
  // 헤더를 먼저 출력합니다.
  Serial.println("time_ms,light_adc,occupied,lamp");
  delay(30000);
}
void loop() {
  int light=analogRead(LIGHT_PIN);
  if(digitalRead(PIR_PIN)==HIGH) {
    lastMotion=millis();
    motionSeen=true;
  }
  bool occupied=motionSeen && millis()-lastMotion<holdOnMs;
  // 릴레이 보호를 위해 상태를 바꾼 뒤 10초 동안은 다시 바꾸지 않습니다.
  if (millis()-lastSwitch>=10000) {
    if (!lamp && occupied && light<darkThreshold) {
      lamp=true;
      lastSwitch=millis();
    }
    else if (lamp && (!occupied || light>brightThreshold)) {
      lamp=false;
      lastSwitch=millis();
    }
  }
  digitalWrite(RELAY_PIN,lamp ? HIGH : LOW);
  Serial.print(millis());
  Serial.print(',');
  Serial.print(light);
  Serial.print(',');
  Serial.print(occupied);
  Serial.print(',');
  Serial.println(lamp);
  delay(250);
}
