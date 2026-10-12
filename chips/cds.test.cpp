#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include "../logic/vendor/doctest.h"

#include "cds.h"

TEST_CASE("resistance follows the GL5528 datasheet curve") {
  CHECK(cds_resistance_ohms(10) == doctest::Approx(15000));
  // gamma 0.7: ten times the light is 10^0.7 = 5.01 times less resistance.
  CHECK(cds_resistance_ohms(100) == doctest::Approx(15000 / 5.0119).epsilon(0.001));
  CHECK(cds_resistance_ohms(1000) < cds_resistance_ohms(100));
}

TEST_CASE("darkness reads the dark resistance, never more") {
  CHECK(cds_resistance_ohms(0) == CDS_DARK_OHMS);
  CHECK(cds_resistance_ohms(0.0001) == CDS_DARK_OHMS);
}

TEST_CASE("the divider node rises with light when the CdS is on the supply side") {
  CHECK(cds_divider_volts(0, 5, 10000) == doctest::Approx(5 * 10000 / 1010000.0));
  CHECK(cds_divider_volts(10, 5, 10000) == doctest::Approx(2.0));
  CHECK(cds_divider_volts(1000, 5, 10000) > cds_divider_volts(100, 5, 10000));
  CHECK(cds_divider_volts(1e9, 5, 10000) < 5);
}
