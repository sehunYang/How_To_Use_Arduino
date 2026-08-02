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

TEST_CASE("B1 the control jar's own rise is removed from the fermentation slope") {
  CHECK(phase7::pressureSlope(24.0, 10.0) == doctest::Approx(2.4));
  CHECK(phase7::pressureSlope(24.0, 0.0) == doctest::Approx(0.0));
  CHECK(phase7::netSlope(2.4, 0.4) == doctest::Approx(2.0));
}
TEST_CASE("B2 transpiration is reported per leaf area so plant sizes compare") {
  CHECK(phase7::transpirationPerArea(1.8, 60.0) == doctest::Approx(0.03));
  CHECK(phase7::transpirationPerArea(1.8, 0.0) == doctest::Approx(0.0));
}
TEST_CASE("B3 brighter light that adds no slope means the plant is saturated") {
  CHECK_FALSE(phase7::isLightSaturated(1.0, 1.8, 0.2));
  CHECK(phase7::isLightSaturated(1.8, 1.85, 0.2));
  // 어두운 조건의 음수 기울기(호흡)는 잘라 내지 않습니다.
  CHECK(phase7::netSlope(-0.3, 0.0) == doctest::Approx(-0.3));
}
TEST_CASE("B4 trials that timed out or beat human reflexes are dropped") {
  CHECK(phase7::isUsableReaction(280, 3000, 100));
  CHECK_FALSE(phase7::isUsableReaction(3000, 3000, 100));
  CHECK_FALSE(phase7::isUsableReaction(60, 3000, 100));
}
TEST_CASE("B5 a minimum gap stops one stride from being counted twice") {
  const double stride[] = {1.0, 1.4, 1.35, 1.0, 1.0, 1.4, 1.0, 1.0, 1.45, 1.0};
  CHECK(phase7::countSteps(stride, 10, 1.2, 60, 20) == 3);
  // 간격을 요구하지 않으면 같은 걸음의 두 봉우리가 따로 세어집니다.
  const double doubled[] = {1.4, 1.0, 1.4, 1.0, 1.4};
  CHECK(phase7::countSteps(doubled, 5, 1.2, 0, 20) == 3);
}
TEST_CASE("B6 recovery is read off the slope of the log of excess temperature") {
  CHECK(phase7::excessTemperature(34.2, 33.0) == doctest::Approx(1.2));
  CHECK(phase7::recoveryTimeConstant(-0.25) == doctest::Approx(4.0));
  CHECK(phase7::recoveryTimeConstant(0.1) == doctest::Approx(0.0));
}
TEST_CASE("B7 the two photocells' own mismatch is subtracted before comparing") {
  CHECK(phase7::gradientError(700, 400, 0) == 300);
  CHECK(phase7::gradientError(700, 400, 40) == 260);
}
TEST_CASE("B8 time spent below the base temperature adds nothing") {
  CHECK(phase7::growingDegreeMinutes(18.0, 5.0, 60.0) == doctest::Approx(780.0));
  CHECK(phase7::growingDegreeMinutes(3.0, 5.0, 60.0) == doctest::Approx(0.0));
}

TEST_CASE("C1 a wet bulb reading above the dry bulb means the probes are swapped") {
  CHECK(phase7::wetBulbDepression(24.0, 18.5) == doctest::Approx(5.5));
  CHECK(phase7::isPsychrometerOrdered(24.0, 18.5));
  CHECK_FALSE(phase7::isPsychrometerOrdered(18.5, 24.0));
}
TEST_CASE("C2 salt splits into two particles so it depresses twice as far") {
  CHECK(phase7::freezingDepression(0.0, -2.1) == doctest::Approx(2.1));
  CHECK(phase7::expectedDepression(1.86, 0.5, 2.0) == doctest::Approx(1.86));
  CHECK(phase7::expectedDepression(1.86, 0.5, 1.0) == doctest::Approx(0.93));
}
TEST_CASE("C3 transmittance needs a clear-water baseline to divide by") {
  CHECK(phase7::transmittancePercent(420.0, 840.0) == doctest::Approx(50.0));
  CHECK(phase7::transmittancePercent(420.0, 0.0) == doctest::Approx(0.0));
}
TEST_CASE("C4 the cooling the beaker would have done anyway is subtracted") {
  CHECK(phase7::backgroundCorrected(24.0, -0.1, 5.0) == doctest::Approx(24.5));
  CHECK(phase7::backgroundCorrected(24.0, 0.0, 5.0) == doctest::Approx(24.0));
}
TEST_CASE("C5 reflectance is measured against white paper, box glare removed") {
  CHECK(phase7::relativeReflectance(300.0, 100.0, 900.0) == doctest::Approx(0.25));
  CHECK(phase7::relativeReflectance(300.0, 900.0, 900.0) == doctest::Approx(0.0));
}
TEST_CASE("C6 soil heats faster than water by the inverse of their heat capacity") {
  CHECK(phase7::slopeRatio(0.25, 0.05) == doctest::Approx(5.0));
  CHECK(phase7::slopeRatio(0.25, 0.0) == doctest::Approx(0.0));
}
TEST_CASE("C7 absorbance is undefined once no light gets through at all") {
  CHECK(phase7::absorbance(100.0, 1000.0) == doctest::Approx(1.0));
  CHECK(phase7::absorbance(1000.0, 1000.0) == doctest::Approx(0.0));
  CHECK(phase7::absorbance(0.0, 1000.0) == doctest::Approx(0.0));
}
TEST_CASE("C8 a room that swaps its air faster comes back sooner") {
  CHECK(phase7::airChangeTimeConstantMin(600.0, 150.0) == doctest::Approx(4.0));
  CHECK(phase7::airChangeTimeConstantMin(600.0, 0.0) == doctest::Approx(0.0));
}

TEST_CASE("D1 the controller nudges toward the target instead of jumping to it") {
  CHECK(phase7::pulsesToRpm(2, 1.0) == 120);
  CHECK(phase7::pulsesToRpm(2, 0.0) == 0);
  CHECK(phase7::correctedSpeed(150, 30, 5) == 155);
  CHECK(phase7::correctedSpeed(150, -30, 5) == 145);
  CHECK(phase7::correctedSpeed(254, 30, 5) == 255);
}
TEST_CASE("D2 a level reads gravity, so it only means anything at rest") {
  CHECK(phase7::rollDegrees(0.0, 1.0) == doctest::Approx(0.0));
  CHECK(phase7::rollDegrees(1.0, 0.0) == doctest::Approx(90.0));
  CHECK(phase7::rollDegrees(-1.0, 0.0) == doctest::Approx(-90.0));
}
TEST_CASE("D3 steering is proportional to how far off the line the car is") {
  CHECK(phase7::steeringCorrection(700, 400, 0.35) == 105);
  CHECK(phase7::steeringCorrection(400, 400, 0.35) == 0);
  CHECK(phase7::steeringCorrection(400, 700, 0.35) == -105);
}
TEST_CASE("D4 a single threshold flips on noise, a split one does not") {
  // 여는 20 cm, 닫는 25 cm. 21과 24 사이를 오가도 상태는 그대로입니다.
  bool open = phase7::hysteresisOnBelow(false, 21.0, 20.0, 25.0);
  CHECK_FALSE(open);
  open = phase7::hysteresisOnBelow(open, 19.0, 20.0, 25.0);
  CHECK(open);
  open = phase7::hysteresisOnBelow(open, 24.0, 20.0, 25.0);
  CHECK(open);
  open = phase7::hysteresisOnBelow(open, 26.0, 20.0, 25.0);
  CHECK_FALSE(open);
  CHECK(phase7::isEchoValid(35));
  CHECK_FALSE(phase7::isEchoValid(-1));
}
TEST_CASE("D5 the curtain opens bright and closes dark, with room in between") {
  bool open = phase7::hysteresisOnAbove(false, 320.0, 300.0, 150.0);
  CHECK(open);
  open = phase7::hysteresisOnAbove(open, 200.0, 300.0, 150.0);
  CHECK(open);
  open = phase7::hysteresisOnAbove(open, 140.0, 300.0, 150.0);
  CHECK_FALSE(open);
}
TEST_CASE("D6 the alarm needs to cool a whole degree before it lets go") {
  bool alarming = phase7::hysteresisOnAbove(false, 30.4, 30.0, 29.0);
  CHECK(alarming);
  alarming = phase7::hysteresisOnAbove(alarming, 29.6, 30.0, 29.0);
  CHECK(alarming);
  alarming = phase7::hysteresisOnAbove(alarming, 28.9, 30.0, 29.0);
  CHECK_FALSE(alarming);
}
TEST_CASE("D7 gravity is removed before a shake is judged, and the alarm holds") {
  CHECK(phase7::dynamicMagnitude(1.0) == doctest::Approx(0.0));
  CHECK(phase7::dynamicMagnitude(1.12) == doctest::Approx(0.12));
  CHECK(phase7::dynamicMagnitude(0.88) == doctest::Approx(0.12));
  CHECK(phase7::alarmHeld(5000UL, 7000UL));
  CHECK_FALSE(phase7::alarmHeld(8000UL, 7000UL));
}
TEST_CASE("D8 floors get misread once the noise is half the floor spacing") {
  CHECK(phase7::floorIndex(24, 8.0) == 3);
  CHECK(phase7::floorIndex(27, 8.0) == 3);
  CHECK(phase7::floorIndex(-1, 8.0) == -1);
  CHECK(phase7::floorJudgementIsSafe(1.0, 8.0));
  CHECK_FALSE(phase7::floorJudgementIsSafe(3.0, 4.0));
}

TEST_CASE("E1 terminal speed grows with the square root of the weight") {
  // 15 cm에서 10 cm로 0.05초 만에 다가오면 1 m/s입니다.
  CHECK(phase7::velocityMps(15, 10, 1000UL, 1050UL) == doctest::Approx(1.0));
  CHECK(phase7::velocityMps(15, -1, 1000UL, 1050UL) == doctest::Approx(0.0));
  const double one = phase7::terminalVelocity(0.001, 0.01);
  const double four = phase7::terminalVelocity(0.004, 0.01);
  CHECK(four / one == doctest::Approx(2.0));
}
TEST_CASE("E2 the half life of the swing does not depend on where it started") {
  const double lambda = phase7::dampingConstant(1.0, 0.5, 4.0);
  CHECK(lambda == doctest::Approx(0.17328).epsilon(0.001));
  CHECK(phase7::amplitudeHalfLife(lambda) == doctest::Approx(4.0));
  // 진폭이 늘었다면 감쇠로 읽으면 안 됩니다.
  CHECK(phase7::dampingConstant(0.5, 1.0, 4.0) == doctest::Approx(0.0));
}
TEST_CASE("E3 moving the same mass twice as far out quadruples the inertia") {
  const double inner = phase7::momentOfInertia(0.05, 0.05, 4);
  const double outer = phase7::momentOfInertia(0.05, 0.10, 4);
  CHECK(outer / inner == doctest::Approx(4.0));
  CHECK(phase7::expectedSlopeRatio(inner, outer) == doctest::Approx(4.0));
}
