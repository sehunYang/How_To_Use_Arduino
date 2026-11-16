#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include "../logic/vendor/doctest.h"

#include <cmath>

#include "ina219rc.h"

namespace {
RcBranch ph21() {
  RcBranch rc;
  rc_init(&rc, 5, 1000, 1000e-6);
  return rc;
}
}  // namespace

TEST_CASE("stays discharged until the source is connected") {
  RcBranch rc = ph21();
  CHECK(rc_capacitor_volts(&rc, 10) == 0);
  CHECK(rc_current_amps(&rc, 10) == 0);
}

TEST_CASE("charges with tau = (R + shunt) C") {
  RcBranch rc = ph21();
  rc_set_connected(&rc, true, 2);
  const double tau = rc_time_constant(&rc);
  CHECK(tau == doctest::Approx(1.0001));
  CHECK(rc_current_amps(&rc, 2) == doctest::Approx(5 / 1000.1));
  CHECK(rc_capacitor_volts(&rc, 2 + tau) == doctest::Approx(5 * (1 - std::exp(-1.0))));
  CHECK(rc_current_amps(&rc, 2 + 2 * tau) == doctest::Approx(5 / 1000.1 * std::exp(-2.0)));
}

TEST_CASE("keeps its charge when the source is removed, and resumes from it") {
  RcBranch rc = ph21();
  rc_set_connected(&rc, true, 0);
  const double held = rc_capacitor_volts(&rc, 1);
  rc_set_connected(&rc, false, 1);
  CHECK(rc_capacitor_volts(&rc, 5) == doctest::Approx(held));
  CHECK(rc_current_amps(&rc, 5) == 0);
  rc_set_connected(&rc, true, 5);
  CHECK(rc_capacitor_volts(&rc, 5) == doctest::Approx(held));
  CHECK(rc_current_amps(&rc, 5) == doctest::Approx((5 - held) / 1000.1));
}

TEST_CASE("feeds the INA219 its raw shunt and bus readings") {
  CHECK(rc_shunt_raw(0.005) == 50);       // 5 mA × 0.1 Ω = 500 µV
  CHECK(rc_bus_register(3.16) == (790 << 3));
  CHECK(rc_bus_register(-1) == 0);
}
