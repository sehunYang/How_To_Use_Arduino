#ifndef CHIPS_TSL2591_H
#define CHIPS_TSL2591_H

// TSL2591 light sensor — register LOGIC only. Packaging this as a runnable Wokwi
// custom chip (WASM build + chip.json + publishing) needs the Wokwi CLI/account covered
// by docs/wokwi-setup.md (US-209); this file proves the register behaviour host-side,
// independent of that runtime.

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// The TSL2591 has no address-select pin — it is always 0x29
// (matches src/data/inventory-seed/sensors.ts: addressing.mode 'fixed').
#define TSL2591_I2C_ADDRESS 0x29

// Register map (TSL2591 datasheet).
#define TSL2591_REG_ENABLE 0x00
#define TSL2591_REG_CONFIG 0x01
#define TSL2591_REG_C0DATAL 0x14  // CH0 = full spectrum (visible + IR)
#define TSL2591_REG_C0DATAH 0x15
#define TSL2591_REG_C1DATAL 0x16  // CH1 = infrared only
#define TSL2591_REG_C1DATAH 0x17

// ENABLE bits.
#define TSL2591_ENABLE_PON 0x01
#define TSL2591_ENABLE_AEN 0x02

// CONFIG field layout: gain in bits 5-4, integration time in bits 2-0.
#define TSL2591_CONFIG_GAIN_MASK 0x30
#define TSL2591_CONFIG_GAIN_SHIFT 4
#define TSL2591_CONFIG_ATIME_MASK 0x07

typedef struct Tsl2591Registers {
  uint8_t enable;
  uint8_t config;
  uint16_t ch0;  // exposed over I2C as C0DATAL/C0DATAH
  uint16_t ch1;  // exposed over I2C as C1DATAL/C1DATAH
  // Incident light, in ADC counts at 1x gain / 100 ms. Not an I2C-visible register:
  // this is the simulated photodiode input the data registers are derived from.
  uint32_t rawCh0;
  uint32_t rawCh1;
} Tsl2591Registers;

void tsl2591_reset(Tsl2591Registers* regs);

// Registers are byte-wide on this chip, so CH0/CH1 are read one byte at a time.
// Writes to the read-only data registers are ignored; a CONFIG write re-derives them.
void tsl2591_write_register(Tsl2591Registers* regs, uint8_t addr, uint8_t value);
uint8_t tsl2591_read_register(const Tsl2591Registers* regs, uint8_t addr);

// Stands in for the photodiodes: sets incident light and re-derives CH0/CH1.
void tsl2591_set_raw_counts(Tsl2591Registers* regs, uint32_t rawCh0, uint32_t rawCh1);

uint16_t tsl2591_gain_multiplier(uint8_t config);   // 1, 25, 428 or 9876
uint8_t tsl2591_integration_multiplier(uint8_t config);  // 1..6, i.e. 100 ms..600 ms

// Simplified model: both channels scale linearly with gain and integration time —
// counts = raw * gain * (atime + 1) — saturating at the ADC's 16-bit full scale.
// Reads back 0 unless the device is powered on with the ALS enabled (PON | AEN),
// which is what the real chip does before its first integration cycle completes.
void tsl2591_recompute(Tsl2591Registers* regs);

#ifdef __cplusplus
}
#endif

#endif  // CHIPS_TSL2591_H
