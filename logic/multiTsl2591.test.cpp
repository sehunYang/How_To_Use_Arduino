#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include "vendor/doctest.h"

#include "multiTsl2591.h"

TEST_CASE("splitLuminosity takes CH0 from the low half and CH1 from the high half") {
  const logic::Luminosity l = logic::splitLuminosity(0x1234ABCDu);
  CHECK(l.ch0 == 0xABCD);
  CHECK(l.ch1 == 0x1234);
}

TEST_CASE("splitLuminosity handles a dark reading") {
  const logic::Luminosity l = logic::splitLuminosity(0u);
  CHECK(l.ch0 == 0);
  CHECK(l.ch1 == 0);
}

TEST_CASE("splitLuminosity handles a saturated reading") {
  const logic::Luminosity l = logic::splitLuminosity(0xFFFFFFFFu);
  CHECK(l.ch0 == 0xFFFF);
  CHECK(l.ch1 == 0xFFFF);
}
