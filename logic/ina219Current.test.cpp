#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include "vendor/doctest.h"

#include "ina219Current.h"

TEST_CASE("signedCurrent preserves positive INA219 readings") {
  CHECK(logic::signedCurrent(250) == 250);
}

TEST_CASE("signedCurrent decodes the register's two's-complement value") {
  CHECK(logic::signedCurrent(0xffff) == -1);
  CHECK(logic::signedCurrent(0x8000) == -32768);
}
