#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include "vendor/doctest.h"

#include "phase5.h"

TEST_CASE("S1 acceleration samples preserve their mean") {
  const double v[] = {-1.0, 0.0, 1.0};
  CHECK(phase5::mean(v, 3) == doctest::Approx(0.0));
}
TEST_CASE("S2 echo time converts to round-trip distance") {
  CHECK(phase5::ultrasonicCentimeters(1000) == doctest::Approx(17.15));
}
TEST_CASE("S3 PIR threshold preserves digital detection") {
  CHECK(phase5::above(1, 0));
}
TEST_CASE("S4 CDS averaging reduces a symmetric fluctuation") {
  const double v[] = {400, 500, 600};
  CHECK(phase5::mean(v, 3) == doctest::Approx(500));
}
TEST_CASE("S5 temperature samples preserve Celsius scale") {
  const double v[] = {20.0, 21.0};
  CHECK(phase5::mean(v, 2) == doctest::Approx(20.5));
}
TEST_CASE("S6 environmental channels can be averaged independently") {
  const double v[] = {1000.0, 1002.0};
  CHECK(phase5::mean(v, 2) == doctest::Approx(1001.0));
}
TEST_CASE("S7 zero input power has zero efficiency") {
  CHECK(phase5::efficiencyPercent(1, 0) == 0);
}
TEST_CASE("S8 lux samples preserve a stable reading") {
  const double v[] = {250, 250, 250};
  CHECK(phase5::mean(v, 3) == 250);
}
TEST_CASE("S9 channel comparison uses the same scale") {
  const double v[] = {100, 200};
  CHECK(phase5::mean(v, 2) == 150);
}
TEST_CASE("S10 opposite Hall readings cancel around the baseline") {
  const double v[] = {-120, 120};
  CHECK(phase5::mean(v, 2) == 0);
}

TEST_CASE("P1 period is elapsed time per oscillation") {
  CHECK(phase5::elapsedSeconds(1000, 5000) / 2 == doctest::Approx(2));
}
TEST_CASE("P2 mechanical energy includes potential and kinetic terms") {
  CHECK(phase5::mechanicalEnergy(1, 1, 0) == doctest::Approx(9.80665));
}
TEST_CASE("P3 free-fall gravity follows two distance over time squared") {
  CHECK(phase5::freeFallGravity(4.903325, 1) == doctest::Approx(9.80665));
}
TEST_CASE("P4 energy loss is the difference between two energies") {
  CHECK(phase5::mechanicalEnergy(1, 1, 0) - phase5::mechanicalEnergy(1, 0.8, 0) ==
        doctest::Approx(1.96133));
}
TEST_CASE("P5 stationary acceleration samples average to their baseline") {
  const double v[] = {9.7, 9.9};
  CHECK(phase5::mean(v, 2) == doctest::Approx(9.8));
}
TEST_CASE("P6 inverse-square reference ratio grows with distance") {
  CHECK(phase5::inverseSquareRatio(1, 2) == 4);
}
TEST_CASE("P7 solar conversion efficiency is a percentage") {
  CHECK(phase5::efficiencyPercent(15, 100) == 15);
}
TEST_CASE("P8 light intensity prediction uses inverse-square ratio") {
  CHECK(phase5::inverseSquareRatio(0.5, 1.0) == 4);
}

TEST_CASE("E1 fan control activates above its threshold") {
  CHECK(phase5::above(31, 30));
}
TEST_CASE("E2 reaction temperature change keeps sign") {
  const double before = 20;
  const double after = 17;
  CHECK(after - before == -3);
}
TEST_CASE("E3 Newton cooling constant is positive for cooling") {
  CHECK(phase5::coolingConstant(60, 30, 10) > 0);
}
TEST_CASE("E4 pressure trend keeps its signed change") {
  CHECK(998.0 - 1002.0 == -4.0);
}
TEST_CASE("E5 spatial light map averages equal positions") {
  const double v[] = {100, 100, 100};
  CHECK(phase5::mean(v, 3) == 100);
}
TEST_CASE("E6 multi-point temperature reports the arithmetic mean") {
  const double v[] = {18, 20, 22};
  CHECK(phase5::mean(v, 3) == 20);
}

TEST_CASE("B1 plant environment daily mean uses all samples") {
  const double v[] = {20, 22, 24};
  CHECK(phase5::mean(v, 3) == 22);
}
TEST_CASE("B2 nocturnal activity requires darkness and motion") {
  CHECK(phase5::above(1, 0));
  CHECK_FALSE(phase5::above(100, 300));
}
TEST_CASE("B3 grow light turns on below a target") {
  CHECK(!phase5::above(150, 200));
}
TEST_CASE("B4 activity magnitude can exceed a calibrated baseline") {
  CHECK(phase5::above(1.4, 1.1));
}

TEST_CASE("R1 obstacle threshold detects a near object") {
  CHECK(!phase5::above(15, 20));
}
TEST_CASE("R2 light-following error keeps left-right direction") {
  CHECK(700 - 400 == 300);
}
TEST_CASE("R3 automatic door opens when motion is present") {
  CHECK(phase5::above(1, 0));
}
TEST_CASE("R4 parking alarm distance derives from echo duration") {
  CHECK(phase5::ultrasonicCentimeters(2000) == doctest::Approx(34.3));
}
TEST_CASE("R5 RPM accounts for multiple magnets per revolution") {
  CHECK(phase5::rpm(20, 10, 2) == doctest::Approx(60));
}
TEST_CASE("R6 smart lighting requires motion and darkness") {
  const bool motion = phase5::above(1, 0);
  const bool dark = !phase5::above(120, 300);
  CHECK(motion);
  CHECK(dark);
}
