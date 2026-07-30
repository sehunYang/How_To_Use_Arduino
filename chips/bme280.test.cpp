#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include "../logic/vendor/doctest.h"

#include "bme280.h"

static uint32_t read20(const Bme280Registers& regs, uint8_t address) {
  return ((uint32_t)bme280_read_register(&regs, address) << 12) |
         ((uint32_t)bme280_read_register(&regs, address + 1) << 4) |
         (bme280_read_register(&regs, address + 2) >> 4);
}

TEST_CASE("Adafruit startup can identify the chip and read calibration") {
  Bme280Registers regs;
  bme280_reset(&regs);

  CHECK(bme280_read_register(&regs, 0xD0) == 0x60);
  CHECK(bme280_read_register(&regs, 0x88) == 0x70);
  CHECK(bme280_read_register(&regs, 0x89) == 0x6B);
  CHECK(bme280_read_register(&regs, 0xA1) == 75);
  CHECK(bme280_read_register(&regs, 0xE1) == 0x6A);
  CHECK(bme280_read_register(&regs, 0xE7) == 30);
}

TEST_CASE("control registers round-trip and mask humidity oversampling") {
  Bme280Registers regs;
  bme280_reset(&regs);

  bme280_write_register(&regs, 0xF2, 0xFF);
  bme280_write_register(&regs, 0xF4, 0xB7);
  bme280_write_register(&regs, 0xF5, 0xA0);

  CHECK(bme280_read_register(&regs, 0xF2) == 0x07);
  CHECK(bme280_read_register(&regs, 0xF4) == 0xB7);
  CHECK(bme280_read_register(&regs, 0xF5) == 0xA0);
  CHECK(bme280_read_register(&regs, 0xF3) == 0);
}

TEST_CASE("measurement window uses the datasheet byte packing") {
  Bme280Registers regs;
  bme280_reset(&regs);
  bme280_set_raw_measurement(&regs, 0xABCDE, 0x54321, 0x6789);

  CHECK(read20(regs, 0xF7) == 0x54321);
  CHECK(read20(regs, 0xFA) == 0xABCDE);
  CHECK(bme280_read_register(&regs, 0xFD) == 0x67);
  CHECK(bme280_read_register(&regs, 0xFE) == 0x89);
}

TEST_CASE("20-bit ADC inputs are bounded to the hardware width") {
  Bme280Registers regs;
  bme280_reset(&regs);
  bme280_set_raw_measurement(&regs, 0x1ABCDE, 0x254321, 0x6789);

  CHECK(read20(regs, 0xF7) == 0x54321);
  CHECK(read20(regs, 0xFA) == 0xABCDE);
}

TEST_CASE("soft reset restores power-on controls and deterministic samples") {
  Bme280Registers regs;
  bme280_reset(&regs);
  bme280_write_register(&regs, 0xF2, 5);
  bme280_write_register(&regs, 0xF4, 0xFF);
  bme280_set_raw_measurement(&regs, 1, 2, 3);

  bme280_write_register(&regs, 0xE0, 0xB6);

  CHECK(bme280_read_register(&regs, 0xF2) == 0);
  CHECK(bme280_read_register(&regs, 0xF4) == 0);
  CHECK(read20(regs, 0xF7) == 415148);
  CHECK(read20(regs, 0xFA) == 519888);
}

TEST_CASE("calibration, identity and samples are read-only") {
  Bme280Registers regs;
  bme280_reset(&regs);

  bme280_write_register(&regs, 0x88, 0);
  bme280_write_register(&regs, 0xD0, 0);
  bme280_write_register(&regs, 0xF7, 0);

  CHECK(bme280_read_register(&regs, 0x88) == 0x70);
  CHECK(bme280_read_register(&regs, 0xD0) == 0x60);
  CHECK(read20(regs, 0xF7) == 415148);
}
