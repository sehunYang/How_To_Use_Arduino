#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include "../logic/vendor/doctest.h"

#include "tsl2591.h"

// Addresses are written as raw hex here rather than via the TSL2591_REG_* macros so the
// tests fail if a macro is ever pointed at the wrong address.

namespace {

// CH0/CH1 are byte-wide registers, so a reader has to assemble low + high itself.
uint16_t readCh0(const Tsl2591Registers& regs) {
  return (uint16_t)(tsl2591_read_register(&regs, 0x14) |
                    (tsl2591_read_register(&regs, 0x15) << 8));
}

uint16_t readCh1(const Tsl2591Registers& regs) {
  return (uint16_t)(tsl2591_read_register(&regs, 0x16) |
                    (tsl2591_read_register(&regs, 0x17) << 8));
}

// Powered on, ALS enabled, at the given gain/integration-time CONFIG value.
Tsl2591Registers running(uint8_t config, uint32_t rawCh0, uint32_t rawCh1) {
  Tsl2591Registers regs;
  tsl2591_reset(&regs);
  tsl2591_write_register(&regs, 0x00, TSL2591_ENABLE_PON | TSL2591_ENABLE_AEN);
  tsl2591_write_register(&regs, 0x01, config);
  tsl2591_set_raw_counts(&regs, rawCh0, rawCh1);
  return regs;
}

}  // namespace

TEST_CASE("the chip lives at the fixed I2C address from the inventory data") {
  CHECK(TSL2591_I2C_ADDRESS == 0x29);
}

TEST_CASE("data registers read 0 until the device is powered on with ALS enabled") {
  Tsl2591Registers regs;
  tsl2591_reset(&regs);
  tsl2591_set_raw_counts(&regs, 100, 40);

  CHECK(readCh0(regs) == 0);
  CHECK(readCh1(regs) == 0);

  // PON alone is not enough — the ALS also has to be enabled.
  tsl2591_write_register(&regs, 0x00, TSL2591_ENABLE_PON);
  CHECK(readCh0(regs) == 0);

  tsl2591_write_register(&regs, 0x00, TSL2591_ENABLE_PON | TSL2591_ENABLE_AEN);
  CHECK(readCh0(regs) == 100);
  CHECK(readCh1(regs) == 40);
}

TEST_CASE("CONFIG decodes gain from bits 5-4 and integration time from bits 2-0") {
  CHECK(tsl2591_gain_multiplier(0x00) == 1);
  CHECK(tsl2591_gain_multiplier(0x10) == 25);
  CHECK(tsl2591_gain_multiplier(0x20) == 428);
  CHECK(tsl2591_gain_multiplier(0x30) == 9876);

  CHECK(tsl2591_integration_multiplier(0x00) == 1);  // 100 ms
  CHECK(tsl2591_integration_multiplier(0x05) == 6);  // 600 ms

  // The two fields are independent.
  CHECK(tsl2591_gain_multiplier(0x25) == 428);
  CHECK(tsl2591_integration_multiplier(0x25) == 6);
}

TEST_CASE("CH0/CH1 scale up with gain for the same incident light") {
  const Tsl2591Registers lowGain = running(0x00, 10, 4);   // 1x, 100 ms
  const Tsl2591Registers highGain = running(0x10, 10, 4);  // 25x, 100 ms

  CHECK(readCh0(lowGain) == 10);
  CHECK(readCh1(lowGain) == 4);
  CHECK(readCh0(highGain) == 250);
  CHECK(readCh1(highGain) == 100);
  CHECK(readCh0(highGain) > readCh0(lowGain));
  CHECK(readCh1(highGain) > readCh1(lowGain));
}

TEST_CASE("CH0/CH1 scale up with integration time for the same incident light") {
  const Tsl2591Registers fast = running(0x00, 10, 4);  // 1x, 100 ms
  const Tsl2591Registers slow = running(0x05, 10, 4);  // 1x, 600 ms

  CHECK(readCh0(fast) == 10);
  CHECK(readCh0(slow) == 60);
  CHECK(readCh1(slow) == 24);
}

TEST_CASE("changing CONFIG re-derives the data registers in place") {
  Tsl2591Registers regs = running(0x00, 10, 4);
  CHECK(readCh0(regs) == 10);

  tsl2591_write_register(&regs, 0x01, 0x15);  // 25x gain, 600 ms
  CHECK(readCh0(regs) == 10 * 25 * 6);
  CHECK(readCh1(regs) == 4 * 25 * 6);
}

TEST_CASE("the ADC saturates at 16-bit full scale") {
  const Tsl2591Registers regs = running(0x30, 1000, 1000);  // 9876x, 100 ms
  CHECK(readCh0(regs) == 0xFFFF);
  CHECK(readCh1(regs) == 0xFFFF);
}

TEST_CASE("the low/high byte split matches the assembled 16-bit value") {
  const Tsl2591Registers regs = running(0x10, 10, 4);  // ch0 = 250, ch1 = 100
  CHECK(tsl2591_read_register(&regs, 0x14) == 250);
  CHECK(tsl2591_read_register(&regs, 0x15) == 0);

  const Tsl2591Registers wide = running(0x20, 10, 4);  // ch0 = 4280, ch1 = 1712
  CHECK(readCh0(wide) == 4280);
  CHECK(tsl2591_read_register(&wide, 0x14) == (4280 & 0xFF));
  CHECK(tsl2591_read_register(&wide, 0x15) == (4280 >> 8));
}

TEST_CASE("data registers are read-only") {
  Tsl2591Registers regs = running(0x10, 10, 4);
  tsl2591_write_register(&regs, 0x14, 0xAB);
  tsl2591_write_register(&regs, 0x17, 0xAB);

  CHECK(readCh0(regs) == 250);
  CHECK(readCh1(regs) == 100);
}
