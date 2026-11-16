// link: chips/tsl2591.c
#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include "../logic/vendor/doctest.h"

#include "mpu6050aux.h"

namespace {

void mpuWrite(Mpu6050Aux& mpu, uint8_t reg, uint8_t value) {
  mpu6050aux_connect(&mpu, false);
  mpu6050aux_write(&mpu, reg);
  mpu6050aux_write(&mpu, value);
}

uint8_t mpuRead(Mpu6050Aux& mpu, uint8_t reg) {
  mpu6050aux_connect(&mpu, false);
  mpu6050aux_write(&mpu, reg);
  mpu6050aux_connect(&mpu, true);
  return mpu6050aux_read(&mpu);
}

int16_t mpuRead16(Mpu6050Aux& mpu, uint8_t reg) {
  mpu6050aux_connect(&mpu, false);
  mpu6050aux_write(&mpu, reg);
  mpu6050aux_connect(&mpu, true);
  const uint8_t high = mpu6050aux_read(&mpu);
  return (int16_t)((high << 8) | mpu6050aux_read(&mpu));
}

// Recipe s13's setup(): enable the TSL2591 through bypass, then hand the
// auxiliary bus to the MPU's master and point slave 0 at C0DATAL.
void s13Setup(Mpu6050Aux& mpu, bool bypassFirst = true) {
  mpuWrite(mpu, 0x6B, 0);
  if (bypassFirst) mpuWrite(mpu, 0x37, 0x02);
  if (mpu6050aux_bypass_connect(&mpu, false)) {
    mpu6050aux_bypass_write(&mpu, 0xA0);
    mpu6050aux_bypass_write(&mpu, 3);
  }
  mpuWrite(mpu, 0x37, 0);
  mpuWrite(mpu, 0x6A, 0x20);
  mpuWrite(mpu, 0x24, 0x0D);
  mpuWrite(mpu, 0x25, 0xA9);
  mpuWrite(mpu, 0x26, 0xB4);
  mpuWrite(mpu, 0x27, 0x82);
}

uint16_t extLight(Mpu6050Aux& mpu) {
  const uint8_t low = mpuRead(mpu, 0x49);
  return (uint16_t)(low | (mpuRead(mpu, 0x4A) << 8));
}

}  // namespace

TEST_CASE("powers up asleep with its identity readable") {
  Mpu6050Aux mpu;
  mpu6050aux_init(&mpu, true);
  CHECK(mpuRead(mpu, 0x75) == 0x68);
  CHECK(mpuRead16(mpu, 0x3F) == 0);
}

TEST_CASE("reports acceleration at the selected range once awake") {
  Mpu6050Aux mpu;
  mpu6050aux_init(&mpu, true);
  mpuWrite(mpu, 0x6B, 0);
  CHECK(mpuRead16(mpu, 0x3F) == 16384);
  mpu6050aux_set_accel(&mpu, 0.5f, -0.25f, 1.0f);
  CHECK(mpuRead16(mpu, 0x3B) == 8192);
  CHECK(mpuRead16(mpu, 0x3D) == -4096);
  mpuWrite(mpu, 0x1C, 0x18);  // ±16 g
  CHECK(mpuRead16(mpu, 0x3F) == 2048);
}

TEST_CASE("the auxiliary sensor is on the main bus only in bypass mode") {
  Mpu6050Aux mpu;
  mpu6050aux_init(&mpu, true);
  mpuWrite(mpu, 0x6B, 0);
  CHECK_FALSE(mpu6050aux_bypass_connect(&mpu, false));
  mpuWrite(mpu, 0x37, 0x02);
  CHECK(mpu6050aux_bypass_connect(&mpu, false));
}

TEST_CASE("the master copies slave 0 into EXT_SENS_DATA once per sample") {
  Mpu6050Aux mpu;
  mpu6050aux_init(&mpu, true);
  tsl2591_set_raw_counts(&mpu.tsl, 1234, 321);
  s13Setup(mpu);
  CHECK(extLight(mpu) == 0);  // no sample period has passed yet
  mpu6050aux_sample(&mpu);
  CHECK(extLight(mpu) == 1234);
  tsl2591_set_raw_counts(&mpu.tsl, 5000, 900);
  CHECK(extLight(mpu) == 1234);
  mpu6050aux_sample(&mpu);
  CHECK(extLight(mpu) == 5000);
}

TEST_CASE("a TSL2591 never switched on through bypass reads 0") {
  Mpu6050Aux mpu;
  mpu6050aux_init(&mpu, true);
  tsl2591_set_raw_counts(&mpu.tsl, 1234, 321);
  s13Setup(mpu, false);
  mpu6050aux_sample(&mpu);
  CHECK(extLight(mpu) == 0);
}

TEST_CASE("the master stops while the MPU sleeps") {
  Mpu6050Aux mpu;
  mpu6050aux_init(&mpu, true);
  tsl2591_set_raw_counts(&mpu.tsl, 1234, 321);
  s13Setup(mpu);
  mpuWrite(mpu, 0x6B, 0x40);
  mpu6050aux_sample(&mpu);
  CHECK(extLight(mpu) == 0);
}

TEST_CASE("samples at 8 kHz / (1 + SMPLRT_DIV) with the DLPF off, 1 kHz with it on") {
  Mpu6050Aux mpu;
  mpu6050aux_init(&mpu, true);
  CHECK(mpu6050aux_sample_period_us(&mpu) == 125);
  mpuWrite(mpu, 0x19, 7);
  CHECK(mpu6050aux_sample_period_us(&mpu) == 1000);
  mpuWrite(mpu, 0x1A, 3);
  CHECK(mpu6050aux_sample_period_us(&mpu) == 8000);
}
