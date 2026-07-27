#ifndef CHIPS_INA219_H
#define CHIPS_INA219_H

// INA219 current/power sensor — register LOGIC only. Packaging this as a runnable
// Wokwi custom chip (WASM build + chip.json + publishing) needs the Wokwi CLI/account
// covered by docs/wokwi-setup.md (US-209); this file proves the register behaviour
// host-side, independent of that runtime.

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// Register map (INA219 datasheet, table 1).
#define INA219_REG_CONFIG 0x00       // read-write
#define INA219_REG_SHUNT_VOLTAGE 0x01 // read-only
#define INA219_REG_BUS_VOLTAGE 0x02   // read-only
#define INA219_REG_POWER 0x03         // read-only
#define INA219_REG_CURRENT 0x04       // read-only
#define INA219_REG_CALIBRATION 0x05   // read-write

typedef struct Ina219Registers {
  uint16_t config;
  uint16_t shuntVoltage;
  uint16_t busVoltage;
  uint16_t power;
  uint16_t current;
  uint16_t calibration;
} Ina219Registers;

void ina219_reset(Ina219Registers* regs);

// Writes to the four read-only registers are ignored, as on the real chip.
// A write to CALIBRATION re-derives CURRENT and POWER.
void ina219_write_register(Ina219Registers* regs, uint8_t addr, uint16_t value);

// Unmapped addresses read back as 0.
uint16_t ina219_read_register(const Ina219Registers* regs, uint8_t addr);

// Stands in for the analog front end: pushes a raw shunt/bus conversion result into
// the read-only measurement registers and re-derives CURRENT/POWER. Shunt voltage is
// signed on this chip (current can flow either way); bus voltage is not.
void ina219_set_raw_measurement(Ina219Registers* regs, int16_t shuntRaw, uint16_t busRaw);

// Simplified model of the datasheet's derived registers:
//   CURRENT = (SHUNT_VOLTAGE * CALIBRATION) / 4096
//   POWER   = (CURRENT * BUS_VOLTAGE) / 5000
// The two shift constants are the datasheet's; the per-LSB scaling that converts these
// counts to amps/watts is deliberately left out — the property this models is that the
// calibration register is what turns a fixed raw shunt reading into a current reading.
void ina219_recompute(Ina219Registers* regs);

#ifdef __cplusplus
}
#endif

#endif  // CHIPS_INA219_H
