#include "wokwi-api.h"
#include "tca9548a.h"

#include <stdio.h>
#include <stdlib.h>

// The generator (src/wokwi/phase5ProjectGenerator.ts) reads the recipe's wiring
// and sets `address` from the A0-A2 straps and `tslMask` from the channels that
// carry a TSL2591.
typedef struct {
  Tca9548a mux;
  uint32_t address;
  uint32_t ch0_attr[TCA9548A_CHANNELS];
  uint32_t ch1_attr[TCA9548A_CHANNELS];
} chip_state_t;

static void refresh_light(chip_state_t *chip) {
  for (int channel = 0; channel < TCA9548A_CHANNELS; channel++) {
    tsl2591_set_raw_counts(
        &chip->mux.tsl[channel].registers,
        attr_read(chip->ch0_attr[channel]),
        attr_read(chip->ch1_attr[channel]));
  }
}

static void on_reset_change(void *user_data, pin_t pin, uint32_t value) {
  chip_state_t *chip = user_data;
  tca9548a_set_reset(&chip->mux, value == LOW);
}

static uint8_t on_mux_read(void *user_data) {
  chip_state_t *chip = user_data;
  return tca9548a_read_control(&chip->mux);
}

static bool on_mux_write(void *user_data, uint8_t data) {
  chip_state_t *chip = user_data;
  tca9548a_write_control(&chip->mux, data);
  return true;
}

static bool on_mux_connect(void *user_data, uint32_t address, bool read) {
  chip_state_t *chip = user_data;
  return tca9548a_connect(&chip->mux);
}

static bool on_tsl_connect(void *user_data, uint32_t address, bool read) {
  chip_state_t *chip = user_data;
  if (read) refresh_light(chip);
  return tca9548a_tsl_connect(&chip->mux, read);
}

static uint8_t on_tsl_read(void *user_data) {
  chip_state_t *chip = user_data;
  return tca9548a_tsl_read(&chip->mux);
}

static bool on_tsl_write(void *user_data, uint8_t data) {
  chip_state_t *chip = user_data;
  tca9548a_tsl_write(&chip->mux, data);
  refresh_light(chip);
  return true;
}

void chip_init(void) {
  chip_state_t *chip = calloc(1, sizeof(chip_state_t));
  chip->address = attr_read(attr_init("address", TCA9548A_BASE_ADDRESS));
  tca9548a_init(&chip->mux, (uint8_t)attr_read(attr_init("tslMask", 0)));
  char name[8];
  for (int channel = 0; channel < TCA9548A_CHANNELS; channel++) {
    snprintf(name, sizeof name, "ch0Raw%d", channel);
    chip->ch0_attr[channel] = attr_init(name, 1234);
    snprintf(name, sizeof name, "ch1Raw%d", channel);
    chip->ch1_attr[channel] = attr_init(name, 321);
  }
  refresh_light(chip);

  // The breakout pulls RESET up, so an unwired RESET leaves the switch running.
  const pin_t reset = pin_init("RST", INPUT_PULLUP);
  tca9548a_set_reset(&chip->mux, pin_read(reset) == LOW);
  const pin_watch_config_t watch = {.user_data = chip, .edge = BOTH, .pin_change = on_reset_change};
  pin_watch(reset, &watch);

  // Two devices on one pair of pins: the switch itself, and 0x29 standing for
  // whichever downstream sensors the switch has opened.
  const pin_t scl = pin_init("SCL", INPUT_PULLUP);
  const pin_t sda = pin_init("SDA", INPUT_PULLUP);
  const i2c_config_t mux = {
      .user_data = chip, .address = chip->address, .scl = scl, .sda = sda,
      .connect = on_mux_connect, .read = on_mux_read, .write = on_mux_write,
  };
  i2c_init(&mux);
  if (chip->mux.tslMask) {
    const i2c_config_t tsl = {
        .user_data = chip, .address = TSL2591_I2C_ADDRESS, .scl = scl, .sda = sda,
        .connect = on_tsl_connect, .read = on_tsl_read, .write = on_tsl_write,
    };
    i2c_init(&tsl);
  }
}
