#include "wokwi-api.h"
#include "ina219.h"
#include "sensor-board-display.h"

#include <stdlib.h>

typedef struct {
  Ina219Registers registers;
  uint32_t shunt_raw_attr;
  uint32_t bus_raw_attr;
  uint8_t register_pointer;
  uint8_t write_bytes[2];
  uint8_t write_count;
  uint8_t read_index;
} chip_state_t;

static void refresh_measurement(chip_state_t *chip) {
  ina219_set_raw_measurement(
      &chip->registers,
      (int16_t)attr_read(chip->shunt_raw_attr),
      (uint16_t)attr_read(chip->bus_raw_attr));
}

static bool on_i2c_connect(void *user_data, uint32_t address, bool read) {
  chip_state_t *chip = user_data;
  chip->write_count = 0;
  chip->read_index = 0;
  if (read) {
    refresh_measurement(chip);
  }
  return address == 0x40;
}

static uint8_t on_i2c_read(void *user_data) {
  chip_state_t *chip = user_data;
  const uint16_t value = ina219_read_register(&chip->registers, chip->register_pointer);
  const uint8_t result = chip->read_index == 0 ? (uint8_t)(value >> 8) : (uint8_t)value;
  chip->read_index++;
  if (chip->read_index == 2) {
    chip->read_index = 0;
    chip->register_pointer++;
  }
  return result;
}

static bool on_i2c_write(void *user_data, uint8_t data) {
  chip_state_t *chip = user_data;
  if (chip->write_count == 0) {
    chip->register_pointer = data;
    chip->write_count = 1;
    return true;
  }

  chip->write_bytes[chip->write_count - 1] = data;
  chip->write_count++;
  if (chip->write_count == 3) {
    const uint16_t value = ((uint16_t)chip->write_bytes[0] << 8) | chip->write_bytes[1];
    ina219_write_register(&chip->registers, chip->register_pointer, value);
    chip->register_pointer++;
    chip->write_count = 1;
  }
  return true;
}

void chip_init(void) {
  chip_state_t *chip = calloc(1, sizeof(chip_state_t));
  uint32_t display_width;
  uint32_t display_height;
  const buffer_t framebuffer = framebuffer_init(&display_width, &display_height);
  sensor_draw_ina219_board(framebuffer);
  ina219_reset(&chip->registers);
  chip->shunt_raw_attr = attr_init("shuntRaw", 100);
  chip->bus_raw_attr = attr_init("busRaw", 5000);

  const i2c_config_t config = {
      .user_data = chip,
      .address = 0x40,
      .scl = pin_init("SCL", INPUT_PULLUP),
      .sda = pin_init("SDA", INPUT_PULLUP),
      .connect = on_i2c_connect,
      .read = on_i2c_read,
      .write = on_i2c_write,
  };
  i2c_init(&config);
}
