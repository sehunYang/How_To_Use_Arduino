#pragma once
#include <cstdint>

// L5 logic slot for the "multi-tsl2591" recipe (src/data/canary/multiTsl2591.ts).
//
// Not a pass-through: the sketch prints the raw uint32 from tsl.getFullLuminosity()
// per mux channel, and that value is two ADC channels packed together — CH0
// (full-spectrum, registers 0x14/0x15) in the low 16 bits, CH1 (infrared, 0x16/0x17)
// in the high 16 bits, per Adafruit_TSL2591. Decoding it is the first thing any
// consumer of that reading must do, so it is a genuine pure function worth guarding.

namespace logic {

struct Luminosity {
  uint16_t ch0;  // full spectrum
  uint16_t ch1;  // infrared
};

inline Luminosity splitLuminosity(uint32_t packed) {
  return Luminosity{static_cast<uint16_t>(packed & 0xFFFFu),
                    static_cast<uint16_t>(packed >> 16)};
}

}  // namespace logic
