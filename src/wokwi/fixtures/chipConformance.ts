/**
 * Custom-chip conformance fixture (plan 2.4).
 *
 * Proves that the hand-written INA219 and TSL2591 Wokwi chips
 * (chips/ina219.chip.c, chips/tsl2591.chip.c) answer real I2C register traffic
 * from a real Uno sketch, including a control change applied mid-simulation.
 *
 * Deliberately NOT a Recipe: it carries no `@pin` manifest, no tunables and no
 * teaching content, because no student is ever shown it. Keeping it out of
 * src/data/canary is the point of the split — a recipe's diagram must contain
 * exactly the circuit its `wiring[]` describes (enforced by netlist.ts), and
 * bolting a lux meter and a current sensor onto a pendulum experiment to
 * exercise these chips would have made that guarantee unattainable.
 */
const sketch = `#include <Wire.h>

void writeRegister8(uint8_t address, uint8_t reg, uint8_t value) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

void writeRegister16(uint8_t address, uint8_t reg, uint16_t value) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  Wire.write(value >> 8);
  Wire.write(value & 0xff);
  Wire.endTransmission();
}

uint16_t readRegister16BE(uint8_t address, uint8_t reg) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(address, (uint8_t)2);
  return ((uint16_t)Wire.read() << 8) | Wire.read();
}

uint16_t readRegister16LE(uint8_t address, uint8_t reg) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(address, (uint8_t)2);
  const uint8_t low = Wire.read();
  return low | ((uint16_t)Wire.read() << 8);
}

void setup() {
  Serial.begin(9600);
  Wire.begin();
  Serial.println("WOKWI_READY");

  // INA219: calibration register, then read back the derived current.
  writeRegister16(0x40, 0x05, 4096);
  // TSL2591: COMMAND bit set, enable ALS + power on.
  writeRegister8(0x29, 0xA0 | 0x00, 0x03);

  const uint16_t inaCurrent = readRegister16BE(0x40, 0x04);
  const uint16_t tslCh0 = readRegister16LE(0x29, 0xA0 | 0x14);
  if (inaCurrent == 100 && tslCh0 == 1234) {
    Serial.println("CUSTOM_CHIPS_OK");
  } else {
    Serial.println("CUSTOM_CHIPS_ERROR");
  }
}

void loop() {
  // Re-read every pass so the scenario can change ch0Raw mid-run and observe it.
  Serial.print("TSL_CH0=");
  Serial.println(readRegister16LE(0x29, 0xA0 | 0x14));
  delay(50);
}
`

export const chipConformanceFixture = {
  id: 'chip-conformance',
  sketch,
  baudRate: 9600,
  /**
   * Self-contained Wokwi project directory. wokwi-cli resolves every path in
   * wokwi.toml — firmware, elf, chip binaries — relative to the project root,
   * so the build step copies those artefacts in here rather than pointing at
   * `../../.tools` and `../../chips`. Escaping the project root would work
   * only if wokwi-cli tolerates `..` in uploaded paths, which is not something
   * this repo can verify locally.
   */
  projectDir: 'wokwi/chip-conformance',
  /** Custom chips this rig exercises; `chips/<name>.chip.wasm` is copied in at build time. */
  chips: ['ina219', 'tsl2591'],
} as const
