#include "wokwi-api.h"
#include "tca9548a.h"

#include <stdlib.h>

// The generator (src/wokwi/phase5ProjectGenerator.ts) reads the recipe's wiring
// and sets `address` from the A0-A2 straps and `tslMask` from the channels that
// carry a TSL2591.
typedef enum { TARGET_NONE, TARGET_MUX, TARGET_TSL } target_t;

typedef struct {
  Tca9548a mux;
  uint32_t address;
  target_t target;  // which device the current I2C transaction addressed
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

static bool on_connect(void *user_data, uint32_t address, bool read) {
  chip_state_t *chip = user_data;
  chip->target = TARGET_NONE;
  if (address == chip->address) {
    if (!tca9548a_connect(&chip->mux)) return false;
    chip->target = TARGET_MUX;
    return true;
  }
  if (address == TSL2591_I2C_ADDRESS && chip->mux.tslMask) {
    if (read) refresh_light(chip);
    if (!tca9548a_tsl_connect(&chip->mux, read)) return false;
    chip->target = TARGET_TSL;
    return true;
  }
  return false;
}

static uint8_t on_read(void *user_data) {
  chip_state_t *chip = user_data;
  if (chip->target == TARGET_MUX) return tca9548a_read_control(&chip->mux);
  if (chip->target == TARGET_TSL) return tca9548a_tsl_read(&chip->mux);
  return 0xff;
}

static bool on_write(void *user_data, uint8_t data) {
  chip_state_t *chip = user_data;
  if (chip->target == TARGET_MUX) {
    tca9548a_write_control(&chip->mux, data);
    return true;
  }
  if (chip->target == TARGET_TSL) {
    tca9548a_tsl_write(&chip->mux, data);
    refresh_light(chip);
    return true;
  }
  return false;
}

void chip_init(void) {
  chip_state_t *chip = calloc(1, sizeof(chip_state_t));
  chip->address = attr_read(attr_init("address", TCA9548A_BASE_ADDRESS));
  tca9548a_init(&chip->mux, (uint8_t)attr_read(attr_init("tslMask", 0)));
  // Controls ch0Raw0..ch0Raw7 and ch1Raw0..ch1Raw7.
  char ch0[] = "ch0RawN";
  char ch1[] = "ch1RawN";
  for (int channel = 0; channel < TCA9548A_CHANNELS; channel++) {
    ch0[6] = ch1[6] = (char)('0' + channel);
    chip->ch0_attr[channel] = attr_init(ch0, 1234);
    chip->ch1_attr[channel] = attr_init(ch1, 321);
  }
  refresh_light(chip);

  // The breakout pulls RESET up, so an unwired RESET leaves the switch running.
  const pin_t reset = pin_init("RST", INPUT_PULLUP);
  tca9548a_set_reset(&chip->mux, pin_read(reset) == LOW);
  const pin_watch_config_t watch = {.user_data = chip, .edge = BOTH, .pin_change = on_reset_change};
  pin_watch(reset, &watch);

  // Two devices on one pair of pins: the switch itself, and 0x29 standing for
  // whichever downstream sensors the switch has opened. Wokwi documents one
  // i2c_init per chip, so a single listener takes every address (address 0)
  // and NACKs the ones that are not ours.
  const i2c_config_t bus = {
      .user_data = chip, .address = 0,
      .scl = pin_init("SCL", INPUT_PULLUP), .sda = pin_init("SDA", INPUT_PULLUP),
      .connect = on_connect, .read = on_read, .write = on_write,
  };
  i2c_init(&bus);
}
