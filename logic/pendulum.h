#pragma once
#include <cstdint>

// L5 logic slot for the "pendulum" recipe (src/data/canary/pendulum.ts).
//
// Deliberate pass-through: the sketch's loop calls mpu.getAcceleration(&ax,&ay,&az)
// and Serial.print()s the three raw int16 axes, deriving nothing. Per 확정 1 a recipe
// with no real math still gets a harness slot instead of an exemption, so this groups
// the axes without transforming them. Real math (e.g. period detection) lands here
// later and the existing test file starts guarding it.

namespace logic {

struct AccelReading {
  int16_t ax;
  int16_t ay;
  int16_t az;
};

inline AccelReading formatReading(int16_t ax, int16_t ay, int16_t az) {
  return AccelReading{ax, ay, az};
}

}  // namespace logic
