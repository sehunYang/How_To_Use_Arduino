#include "wokwi-api.h"
#include "mpu6050aux.h"

#include <stdlib.h>

typedef struct {
  Mpu6050Aux mpu;
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

static bool on_mpu_connect(void *user_data, uint32_t address, bool read) {
  chip_state_t *chip = user_data;
  if (read) refresh_inputs(chip);
  mpu6050aux_connect(&chip->mpu, read);
  return true;
}

static uint8_t on_mpu_read(void *user_data) {
  chip_state_t *chip = user_data;
  return mpu6050aux_read(&chip->mpu);
}

static bool on_mpu_write(void *user_data, uint8_t data) {
  chip_state_t *chip = user_data;
  mpu6050aux_write(&chip->mpu, data);
  return true;
}

static bool on_bypass_connect(void *user_data, uint32_t address, bool read) {
  chip_state_t *chip = user_data;
  if (read) refresh_inputs(chip);
  return mpu6050aux_bypass_connect(&chip->mpu, read);
}

static uint8_t on_bypass_read(void *user_data) {
  chip_state_t *chip = user_data;
  return mpu6050aux_bypass_read(&chip->mpu);
}

static bool on_bypass_write(void *user_data, uint8_t data) {
  chip_state_t *chip = user_data;
  mpu6050aux_bypass_write(&chip->mpu, data);
  return true;
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

  const pin_t scl = pin_init("SCL", INPUT_PULLUP);
  const pin_t sda = pin_init("SDA", INPUT_PULLUP);
  const i2c_config_t mpu = {
      .user_data = chip, .address = MPU6050_I2C_ADDRESS, .scl = scl, .sda = sda,
      .connect = on_mpu_connect, .read = on_mpu_read, .write = on_mpu_write,
  };
  i2c_init(&mpu);
  // XDA/XCL joined to the main bus in bypass mode.
  const i2c_config_t bypass = {
      .user_data = chip, .address = TSL2591_I2C_ADDRESS, .scl = scl, .sda = sda,
      .connect = on_bypass_connect, .read = on_bypass_read, .write = on_bypass_write,
  };
  i2c_init(&bypass);

  const timer_config_t sampler = {.user_data = chip, .callback = on_sample};
  chip->sampler = timer_init(&sampler);
  chip->period_us = mpu6050aux_sample_period_us(&chip->mpu);
  timer_start(chip->sampler, chip->period_us, true);
}
