#pragma once

#include <cmath>
#include <cstddef>

namespace phase5 {

inline double mean(const double* values, std::size_t count) {
  if (count == 0) return 0.0;
  double total = 0.0;
  for (std::size_t i = 0; i < count; ++i) total += values[i];
  return total / static_cast<double>(count);
}

inline double elapsedSeconds(unsigned long startMs, unsigned long endMs) {
  return static_cast<double>(endMs - startMs) / 1000.0;
}

inline double ultrasonicCentimeters(unsigned long echoMicroseconds) {
  return static_cast<double>(echoMicroseconds) * 0.0343 / 2.0;
}

inline double freeFallGravity(double distanceMeters, double seconds) {
  return seconds <= 0.0 ? 0.0 : 2.0 * distanceMeters / (seconds * seconds);
}

inline double mechanicalEnergy(double massKg, double heightMeters, double speedMps) {
  return massKg * 9.80665 * heightMeters + 0.5 * massKg * speedMps * speedMps;
}

inline double efficiencyPercent(double outputPower, double inputPower) {
  return inputPower <= 0.0 ? 0.0 : 100.0 * outputPower / inputPower;
}

inline double rpm(unsigned long pulses, double seconds, unsigned pulsesPerRevolution) {
  if (seconds <= 0.0 || pulsesPerRevolution == 0) return 0.0;
  return static_cast<double>(pulses) * 60.0 /
         (seconds * static_cast<double>(pulsesPerRevolution));
}

inline bool above(double value, double threshold) { return value > threshold; }

inline double inverseSquareRatio(double nearDistance, double farDistance) {
  if (nearDistance <= 0.0 || farDistance <= 0.0) return 0.0;
  const double ratio = farDistance / nearDistance;
  return ratio * ratio;
}

inline double coolingConstant(double initialDelta, double laterDelta, double seconds) {
  if (initialDelta <= 0.0 || laterDelta <= 0.0 || seconds <= 0.0) return 0.0;
  return std::log(initialDelta / laterDelta) / seconds;
}

}  // namespace phase5
