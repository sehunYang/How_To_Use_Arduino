#include "wokwi-api.h"
#include "mpu6050aux.h"

#include <stdlib.h>

typedef enum { TARGET_NONE, TARGET_MPU, TARGET_BYPASS } target_t;

typedef struct {
  Mpu6050Aux mpu;
  target_t target;  // which device the current I2C transaction addressed
  uint32_t accel_attr[3];
  uint32_t ch0_raw_attr;
  uint32_t ch1_raw_attr;
  timer_t sampler;
  uint32_t period_us;
} chip_state_t;

static void refresh_inputs(chip_state_t *chip) {
  mpu6050aux_set_accel(&chip->mpu,
      attr_read_float(chip->accel_attr[0]),
      attr_read_float(chip->accel_attr[1]),
      attr_read_float(chip->accel_attr[2]));
  tsl2591_set_raw_counts(&chip->mpu.tsl, attr_read(chip->ch0_raw_attr), attr_read(chip->ch1_raw_attr));
}

static void on_sample(void *user_data) {
  chip_state_t *chip = user_data;
  refresh_inputs(chip);
  mpu6050aux_sample(&chip->mpu);
  // SMPLRT_DIV or CONFIG may have changed the rate.
  const uint32_t period = mpu6050aux_sample_period_us(&chip->mpu);
  if (period != chip->period_us) {
    chip->period_us = period;
    timer_start(chip->sampler, period, true);
  }
}

static bool on_connect(void *user_data, uint32_t address, bool read) {
  chip_state_t *chip = user_data;
  chip->target = TARGET_NONE;
  if (address == MPU6050_I2C_ADDRESS) {
    if (read) refresh_inputs(chip);
    mpu6050aux_connect(&chip->mpu, read);
    chip->target = TARGET_MPU;
    return true;
  }
  if (address == TSL2591_I2C_ADDRESS) {
    if (read) refresh_inputs(chip);
    if (!mpu6050aux_bypass_connect(&chip->mpu, read)) return false;
    chip->target = TARGET_BYPASS;
    return true;
  }
  return false;
}

static uint8_t on_read(void *user_data) {
  chip_state_t *chip = user_data;
  if (chip->target == TARGET_MPU) return mpu6050aux_read(&chip->mpu);
  if (chip->target == TARGET_BYPASS) return mpu6050aux_bypass_read(&chip->mpu);
  return 0xff;
}

static bool on_write(void *user_data, uint8_t data) {
  chip_state_t *chip = user_data;
  if (chip->target == TARGET_MPU) {
    mpu6050aux_write(&chip->mpu, data);
    return true;
  }
  if (chip->target == TARGET_BYPASS) {
    mpu6050aux_bypass_write(&chip->mpu, data);
    return true;
  }
  return false;
}

void chip_init(void) {
  chip_state_t *chip = calloc(1, sizeof(chip_state_t));
  mpu6050aux_init(&chip->mpu, attr_read(attr_init("tslOnAux", 1)) != 0);
  chip->accel_attr[0] = attr_init_float("accelX", 0);
  chip->accel_attr[1] = attr_init_float("accelY", 0);
  chip->accel_attr[2] = attr_init_float("accelZ", 1);
  chip->ch0_raw_attr = attr_init("ch0Raw", 1234);
  chip->ch1_raw_attr = attr_init("ch1Raw", 321);
  pin_init("INT", OUTPUT_LOW);

  // The MPU at 0x68 and, in bypass mode, the TSL2591 on XDA/XCL joined to the
  // main bus. Wokwi documents one i2c_init per chip, so a single listener
  // takes every address (address 0) and NACKs the ones that are not ours.
  const i2c_config_t bus = {
      .user_data = chip, .address = 0,
      .scl = pin_init("SCL", INPUT_PULLUP), .sda = pin_init("SDA", INPUT_PULLUP),
      .connect = on_connect, .read = on_read, .write = on_write,
  };
  i2c_init(&bus);

  const timer_config_t sampler = {.user_data = chip, .callback = on_sample};
  chip->sampler = timer_init(&sampler);
  chip->period_us = mpu6050aux_sample_period_us(&chip->mpu);
  timer_start(chip->sampler, chip->period_us, true);
}
