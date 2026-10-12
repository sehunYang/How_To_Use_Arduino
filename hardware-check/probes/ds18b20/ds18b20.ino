// 실물 점검: DS18B20 (DQ=D2, 4.7 kΩ 풀업)
// 버스의 모든 프로브를 찾아 고유 번호와 해상도를 알리고, 1초마다 온도를 기록합니다.
#include <OneWire.h>

OneWire bus(2);
byte roms[4][8];
byte count = 0;

void setup() {
  Serial.begin(9600);
  Serial.println("# PROBE ds18b20 v1");
  bus.reset_search();
  while (count < 4 && bus.search(roms[count])) {
    Serial.print("# rom=");
    for (byte i = 0; i < 8; i++) {
      if (roms[count][i] < 16) Serial.print('0');
      Serial.print(roms[count][i], HEX);
    }
    Serial.println();
    count++;
  }
  Serial.print("# count=");
  Serial.println(count);
  if (count > 0) {
    // 0x28은 DS18B20, 0x10은 DS18S20, 0x22는 DS1822입니다.
    Serial.print("# family=0x");
    Serial.println(roms[0][0], HEX);
    bus.reset();
    bus.select(roms[0]);
    bus.write(0xBE);
    byte scratch[9];
    for (byte i = 0; i < 9; i++) scratch[i] = bus.read();
    // 설정 바이트의 5~6번 비트가 해상도입니다: 0b11이면 12비트.
    Serial.print("# resolution_bits=");
    Serial.println(9 + ((scratch[4] >> 5) & 3));
  }
  Serial.println("time_ms,index,temperature_c");
}

void loop() {
  bus.reset();
  bus.skip();
  bus.write(0x44);
  delay(750);
  for (byte n = 0; n < count; n++) {
    bus.reset();
    bus.select(roms[n]);
    bus.write(0xBE);
    int16_t raw = bus.read();
    raw |= (int16_t)bus.read() << 8;
    Serial.print(millis());
    Serial.print(',');
    Serial.print(n);
    Serial.print(',');
    Serial.println(raw / 16.0, 4);
  }
  delay(250);
}
