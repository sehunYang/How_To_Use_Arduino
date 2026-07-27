#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include "vendor/doctest.h"

#include "pendulum.h"

TEST_CASE("formatReading groups the three axes without transforming them") {
  const logic::AccelReading r = logic::formatReading(-16384, 0, 16384);
  CHECK(r.ax == -16384);
  CHECK(r.ay == 0);
  CHECK(r.az == 16384);
}

TEST_CASE("formatReading preserves int16 extremes") {
  const logic::AccelReading r = logic::formatReading(-32768, 32767, -1);
  CHECK(r.ax == -32768);
  CHECK(r.ay == 32767);
  CHECK(r.az == -1);
}
