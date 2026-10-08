// @pin A0=A0
// @baud 9600
const byte HALL_PIN=A0;
// 자석을 대었을 때 값이 '내려가는' 극이 센서를 향해야 펄스가 세어집니다.
// 기준값은 자석 없이 읽은 값(대개 512 부근)에 맞춰 조절하세요.
const int MAGNET_THRESHOLD=400,RELEASE_THRESHOLD=500;
unsigned long pulseCount=0,lastPulseUs=0,lastIntervalUs=0;
bool magnetDetected=false;
int hallRaw=0;
void pollHall() {
  hallRaw=analogRead(HALL_PIN);
  if(!magnetDetected&&hallRaw<=MAGNET_THRESHOLD) {
    magnetDetected=true;
    unsigned long now=micros();
    if(lastPulseUs)lastIntervalUs=now-lastPulseUs;
    lastPulseUs=now;
    pulseCount++;
  }
  else if(magnetDetected&&hallRaw>=RELEASE_THRESHOLD)magnetDetected=false;
}
void pollHallFor(unsigned long durationMs) {
  unsigned long start=millis();
  do {
    pollHall();
  }
  while(millis()-start<durationMs);
}
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=100;
void setup() {
  Serial.begin(9600);
  Serial.println("time_ms,hall_raw,pulse_count,pulse_interval_us");
}
void loop() {
  pollHallFor(samplingIntervalMs);
  Serial.print(millis());
  Serial.print(',');
  Serial.print(hallRaw);
  Serial.print(',');
  Serial.print(pulseCount);
  Serial.print(',');
  Serial.println(lastIntervalUs);
}
