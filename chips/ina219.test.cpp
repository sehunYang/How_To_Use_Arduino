#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include "../logic/vendor/doctest.h"

#include "ina219.h"

// Addresses are written as raw hex here rather than via the INA219_REG_* macros so the
// tests fail if a macro is ever pointed at the wrong address.

TEST_CASE("register map round-trips the two writable registers") {
  Ina219Registers regs;
  ina219_reset(&regs);

  ina219_write_register(&regs, 0x00, 0x199F);
  ina219_write_register(&regs, 0x05, 4096);

  CHECK(ina219_read_register(&regs, 0x00) == 0x199F);
  CHECK(ina219_read_register(&regs, 0x05) == 4096);
}

TEST_CASE("the four measurement registers are read-only") {
  Ina219Registers regs;
  ina219_reset(&regs);
  ina219_write_register(&regs, 0x05, 4096);
  ina219_set_raw_measurement(&regs, 1000, 5000);

  ina219_write_register(&regs, 0x01, 0xDEAD);
  ina219_write_register(&regs, 0x02, 0xDEAD);
  ina219_write_register(&regs, 0x03, 0xDEAD);
  ina219_write_register(&regs, 0x04, 0xDEAD);

  CHECK(ina219_read_register(&regs, 0x01) == 1000);
  CHECK(ina219_read_register(&regs, 0x02) == 5000);
  CHECK(ina219_read_register(&regs, 0x03) == 1000);
  CHECK(ina219_read_register(&regs, 0x04) == 1000);
}

TEST_CASE("unmapped addresses read back as 0") {
  Ina219Registers regs;
  ina219_reset(&regs);
  CHECK(ina219_read_register(&regs, 0x06) == 0);
  CHECK(ina219_read_register(&regs, 0xFF) == 0);
}

TEST_CASE("current and power are derived from calibration per the documented model") {
  Ina219Registers regs;
  ina219_reset(&regs);

  ina219_write_register(&regs, 0x05, 4096);
  ina219_set_raw_measurement(&regs, 1000, 5000);

  // CURRENT = (SHUNT * CALIBRATION) / 4096 = (1000 * 4096) / 4096
  CHECK(ina219_read_register(&regs, 0x04) == 1000);
  // POWER = (CURRENT * BUS) / 5000 = (1000 * 5000) / 5000
  CHECK(ina219_read_register(&regs, 0x03) == 1000);
}

TEST_CASE("a different calibration changes current for the same raw shunt/bus reading") {
  Ina219Registers regs;
  ina219_reset(&regs);

  ina219_write_register(&regs, 0x05, 4096);
  ina219_set_raw_measurement(&regs, 1000, 5000);
  const uint16_t calibrated4096 = ina219_read_register(&regs, 0x04);

  // Same raw measurement registers, only the calibration register changes.
  ina219_write_register(&regs, 0x05, 8192);
  const uint16_t calibrated8192 = ina219_read_register(&regs, 0x04);

  CHECK(ina219_read_register(&regs, 0x01) == 1000);
  CHECK(ina219_read_register(&regs, 0x02) == 5000);
  CHECK(calibrated4096 == 1000);
  CHECK(calibrated8192 == 2000);
  CHECK(calibrated8192 != calibrated4096);
  CHECK(ina219_read_register(&regs, 0x03) == 2000);
}

TEST_CASE("an uncalibrated chip reads zero current") {
  Ina219Registers regs;
  ina219_reset(&regs);
  ina219_set_raw_measurement(&regs, 1000, 5000);

  CHECK(ina219_read_register(&regs, 0x05) == 0);
  CHECK(ina219_read_register(&regs, 0x04) == 0);
  CHECK(ina219_read_register(&regs, 0x03) == 0);
}

TEST_CASE("shunt voltage is signed, so reverse current reads back negative") {
  Ina219Registers regs;
  ina219_reset(&regs);

  ina219_write_register(&regs, 0x05, 4096);
  ina219_set_raw_measurement(&regs, -1000, 5000);

  CHECK((int16_t)ina219_read_register(&regs, 0x04) == -1000);
}
