#pragma once
#include <cstdint>

namespace logic {

inline int16_t signedCurrent(uint16_t rawCurrent) {
  return static_cast<int16_t>(rawCurrent);
}

}  // namespace logic
