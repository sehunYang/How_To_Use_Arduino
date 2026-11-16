// link: chips/tsl2591.c
#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include "../logic/vendor/doctest.h"

#include "tca9548a.h"

namespace {

// What a sketch does through the switch: a COMMAND byte (0xA0 | register) then data.
void tslWrite(Tca9548a& mux, uint8_t reg, uint8_t value) {
  REQUIRE(tca9548a_tsl_connect(&mux, false));
  tca9548a_tsl_write(&mux, 0xA0 | reg);
  tca9548a_tsl_write(&mux, value);
}

uint16_t tslReadCh0(Tca9548a& mux) {
  REQUIRE(tca9548a_tsl_connect(&mux, false));
  tca9548a_tsl_write(&mux, 0xA0 | 0x14);
  REQUIRE(tca9548a_tsl_connect(&mux, true));
  const uint8_t low = tca9548a_tsl_read(&mux);
  return (uint16_t)(low | (tca9548a_tsl_read(&mux) << 8));
}

Tca9548a withLight(uint8_t tslMask) {
  Tca9548a mux;
  tca9548a_init(&mux, tslMask);
  for (int channel = 0; channel < TCA9548A_CHANNELS; channel++) {
    tsl2591_set_raw_counts(&mux.tsl[channel].registers, 100u * (channel + 1), 10);
  }
  return mux;
}

}  // namespace

TEST_CASE("the control register opens channels and reads back") {
  Tca9548a mux = withLight(0);
  CHECK(tca9548a_read_control(&mux) == 0);
  tca9548a_write_control(&mux, 0x05);
  CHECK(tca9548a_read_control(&mux) == 0x05);
}

TEST_CASE("only the opened channel's sensor answers 0x29") {
  Tca9548a mux = withLight(0x03);
  CHECK_FALSE(tca9548a_tsl_connect(&mux, false));  // nothing open: NACK
  for (uint8_t channel = 0; channel < 2; channel++) {
    tca9548a_write_control(&mux, (uint8_t)(1u << channel));
    tslWrite(mux, 0x00, 0x03);  // PON | AEN
  }
  tca9548a_write_control(&mux, 0x01);
  CHECK(tslReadCh0(mux) == 100);
  tca9548a_write_control(&mux, 0x02);
  CHECK(tslReadCh0(mux) == 200);
  // A channel with nothing wired to it: NACK.
  tca9548a_write_control(&mux, 0x04);
  CHECK_FALSE(tca9548a_tsl_connect(&mux, true));
}

TEST_CASE("each sensor keeps its own configuration") {
  Tca9548a mux = withLight(0x03);
  tca9548a_write_control(&mux, 0x01);
  tslWrite(mux, 0x00, 0x03);
  tslWrite(mux, 0x01, 0x10);  // channel 0 at medium gain (25x)
  tca9548a_write_control(&mux, 0x02);
  tslWrite(mux, 0x00, 0x03);
  tca9548a_write_control(&mux, 0x01);
  CHECK(tslReadCh0(mux) == 2500);
  tca9548a_write_control(&mux, 0x02);
  CHECK(tslReadCh0(mux) == 200);
}

TEST_CASE("two open sensors at one address collide as a wired AND") {
  Tca9548a mux = withLight(0x03);
  tca9548a_write_control(&mux, 0x03);
  tslWrite(mux, 0x00, 0x03);  // reaches both
  CHECK(tslReadCh0(mux) == (100 & 200));
}

TEST_CASE("reset clears the selection and keeps the switch off the bus") {
  Tca9548a mux = withLight(0x01);
  tca9548a_write_control(&mux, 0x01);
  tca9548a_set_reset(&mux, true);
  CHECK_FALSE(tca9548a_connect(&mux));
  CHECK_FALSE(tca9548a_tsl_connect(&mux, true));
  tca9548a_write_control(&mux, 0x01);  // ignored while held
  tca9548a_set_reset(&mux, false);
  CHECK(tca9548a_connect(&mux));
  CHECK(tca9548a_read_control(&mux) == 0);
}
