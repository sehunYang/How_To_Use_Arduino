#include "wokwi-api.h"
#include "bme280.h"

#include <stdlib.h>

typedef struct {
  Bme280Registers registers;
  uint32_t temperature_raw_attr;
  uint32_t pressure_raw_attr;
  uint32_t humidity_raw_attr;
  uint8_t register_pointer;
  bool awaiting_register;
} chip_state_t;

static void refresh_measurement(chip_state_t* chip) {
  bme280_set_raw_measurement(
      &chip->registers,
      attr_read(chip->temperature_raw_attr),
      attr_read(chip->pressure_raw_attr),
      (uint16_t)attr_read(chip->humidity_raw_attr));
}

static bool on_i2c_connect(void* user_data, uint32_t address, bool read) {
  chip_state_t* chip = user_data;
  chip->awaiting_register = !read;
  if (read) {
    refresh_measurement(chip);
  }
  return address == BME280_I2C_ADDRESS_PRIMARY;
}

static uint8_t on_i2c_read(void* user_data) {
  chip_state_t* chip = user_data;
  const uint8_t value =
      bme280_read_register(&chip->registers, chip->register_pointer);
  chip->register_pointer++;
  return value;
}

static bool on_i2c_write(void* user_data, uint8_t data) {
  chip_state_t* chip = user_data;
  if (chip->awaiting_register) {
    chip->register_pointer = data;
    chip->awaiting_register = false;
  } else {
    bme280_write_register(&chip->registers, chip->register_pointer, data);
    chip->register_pointer++;
  }
  return true;
}

void chip_init(void) {
  chip_state_t* chip = calloc(1, sizeof(chip_state_t));
  bme280_reset(&chip->registers);
  chip->temperature_raw_attr = attr_init("temperatureRaw", 519888);
  chip->pressure_raw_attr = attr_init("pressureRaw", 415148);
  chip->humidity_raw_attr = attr_init("humidityRaw", 30000);

  const i2c_config_t config = {
      .user_data = chip,
      .address = BME280_I2C_ADDRESS_PRIMARY,
      .scl = pin_init("SCL", INPUT_PULLUP),
      .sda = pin_init("SDA", INPUT_PULLUP),
      .connect = on_i2c_connect,
      .read = on_i2c_read,
      .write = on_i2c_write,
  };
  i2c_init(&config);
}
