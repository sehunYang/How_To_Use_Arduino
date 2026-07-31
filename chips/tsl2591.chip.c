#include "wokwi-api.h"
#include "sensor-board-display.h"
#include "tsl2591.h"

#include <stdlib.h>

typedef struct {
  Tsl2591Registers registers;
  uint32_t ch0_raw_attr;
  uint32_t ch1_raw_attr;
  uint8_t register_pointer;
  bool awaiting_register;
  pin_t interrupt_pin;
} chip_state_t;

static void refresh_measurement(chip_state_t *chip) {
  tsl2591_set_raw_counts(
      &chip->registers,
      attr_read(chip->ch0_raw_attr),
      attr_read(chip->ch1_raw_attr));
  const bool interrupt_asserted =
      (chip->registers.enable & TSL2591_ENABLE_AIEN)
      && (chip->registers.ch0 < chip->registers.lowThreshold
          || chip->registers.ch0 > chip->registers.highThreshold);
  pin_write(chip->interrupt_pin, interrupt_asserted ? LOW : HIGH);
}

static bool on_i2c_connect(void *user_data, uint32_t address, bool read) {
  chip_state_t *chip = user_data;
  chip->awaiting_register = !read;
  if (read) {
    refresh_measurement(chip);
  }
  return address == TSL2591_I2C_ADDRESS;
}

static uint8_t on_i2c_read(void *user_data) {
  chip_state_t *chip = user_data;
  const uint8_t value = tsl2591_read_register(&chip->registers, chip->register_pointer);
  chip->register_pointer++;
  return value;
}

static bool on_i2c_write(void *user_data, uint8_t data) {
  chip_state_t *chip = user_data;
  if (chip->awaiting_register) {
    chip->register_pointer = data & 0x1f;
    chip->awaiting_register = false;
  } else {
    tsl2591_write_register(&chip->registers, chip->register_pointer, data);
    chip->register_pointer++;
    refresh_measurement(chip);
  }
  return true;
}

void chip_init(void) {
  chip_state_t *chip = calloc(1, sizeof(chip_state_t));
  uint32_t display_width;
  uint32_t display_height;
  const buffer_t framebuffer = framebuffer_init(&display_width, &display_height);
  sensor_draw_tsl2591_board(framebuffer);
  tsl2591_reset(&chip->registers);
  chip->ch0_raw_attr = attr_init("ch0Raw", 1234);
  chip->ch1_raw_attr = attr_init("ch1Raw", 321);
  chip->interrupt_pin = pin_init("INT", OUTPUT_HIGH);
  pin_init("3VO", OUTPUT_HIGH);

  const i2c_config_t config = {
      .user_data = chip,
      .address = TSL2591_I2C_ADDRESS,
      .scl = pin_init("SCL", INPUT_PULLUP),
      .sda = pin_init("SDA", INPUT_PULLUP),
      .connect = on_i2c_connect,
      .read = on_i2c_read,
      .write = on_i2c_write,
  };
  i2c_init(&config);
}
