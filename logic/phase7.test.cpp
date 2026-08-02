#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include "vendor/doctest.h"

#include "phase7.h"

TEST_CASE("A1 brightness sweep stops at the highest value the pin accepts") {
  CHECK(phase7::ledStepCount(51) == 6);
  CHECK(phase7::ledStepValue(5, 51) == 255);
  CHECK(phase7::ledStepValue(6, 51) == 255);
}
TEST_CASE("A1 ambient light is removed without going below zero") {
  CHECK(phase7::correctedLight(1200.0, 200.0) == doctest::Approx(1000.0));
  CHECK(phase7::correctedLight(150.0, 200.0) == doctest::Approx(0.0));
}
TEST_CASE("A2 doubling the frequency names the same note an octave up") {
  CHECK(phase7::octaveUp(440) == 880);
  CHECK(phase7::sameNoteName(220, 440));
  CHECK_FALSE(phase7::sameNoteName(220, 330));
}
TEST_CASE("A3 servo sweep covers zero to the mechanical limit") {
  CHECK(phase7::servoSweepCount(30) == 7);
  CHECK(phase7::servoSweepAngle(6, 30) == 180);
  CHECK(phase7::servoSweepAngle(7, 30) == 180);
}
TEST_CASE("A4 relay hold never drops below one second") {
  CHECK(phase7::relayHoldMs(5) == 5000UL);
  CHECK(phase7::relayHoldMs(0) == 1000UL);
}
TEST_CASE("A5 matching direction inputs stop the motor") {
  CHECK(phase7::motorDirection(true, false) == 1);
  CHECK(phase7::motorDirection(false, true) == -1);
  CHECK(phase7::motorDirection(true, true) == 0);
  CHECK(phase7::motorSpeed(300) == 255);
  CHECK(phase7::motorSpeed(-5) == 0);
}
TEST_CASE("A6 a display line is never asked to show more than it has") {
  CHECK(phase7::lcdFitsColumns(20, 16) == 16);
  CHECK(phase7::lcdFitsColumns(9, 16) == 9);
}
