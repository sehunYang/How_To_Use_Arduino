#include "wokwi-api.h"
#include "ina219.h"
#include "ina219rc.h"

#include <stdlib.h>

// The generator (src/wokwi/phase5ProjectGenerator.ts) reads the series resistor
// and the capacitance from the recipe. The `connected` control is the moment the
// student connects the source.
typedef struct {
  Ina219Registers registers;
  RcBranch rc;
  uint32_t connected_attr;
  pin_t node;
  uint8_t register_pointer;
  uint8_t write_bytes[2];
  uint8_t write_count;
  uint8_t read_index;
} chip_state_t;

static double now_seconds(void) { return get_sim_nanos() / 1e9; }

static void refresh(void *user_data) {
  chip_state_t *chip = user_data;
  const double now = now_seconds();
  rc_set_connected(&chip->rc, attr_read(chip->connected_attr) != 0, now);
  const double volts = rc_capacitor_volts(&chip->rc, now);
  pin_dac_write(chip->node, (float)volts);
  ina219_set_raw_measurement(&chip->registers, rc_shunt_raw(rc_current_amps(&chip->rc, now)), rc_bus_register(volts));
}

static bool on_i2c_connect(void *user_data, uint32_t address, bool read) {
  chip_state_t *chip = user_data;
  chip->write_count = 0;
  chip->read_index = 0;
  if (read) refresh(chip);
  return true;
}

static uint8_t on_i2c_read(void *user_data) {
  chip_state_t *chip = user_data;
  const uint16_t value = ina219_read_register(&chip->registers, chip->register_pointer);
  const uint8_t result = chip->read_index == 0 ? (uint8_t)(value >> 8) : (uint8_t)value;
  if (++chip->read_index == 2) {
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
  if (++chip->write_count == 3) {
    ina219_write_register(&chip->registers, chip->register_pointer,
        ((uint16_t)chip->write_bytes[0] << 8) | chip->write_bytes[1]);
    chip->register_pointer++;
    chip->write_count = 1;
  }
  return true;
}

void chip_init(void) {
  chip_state_t *chip = calloc(1, sizeof(chip_state_t));
  ina219_reset(&chip->registers);
  rc_init(&chip->rc,
      attr_read_float(attr_init_float("sourceVolts", 5)),
      attr_read_float(attr_init_float("seriesOhms", 1000)),
      attr_read_float(attr_init_float("capacitanceUf", 1000)) * 1e-6);
  chip->connected_attr = attr_init("connected", 0);
  pin_init("VIN+", INPUT);
  chip->node = pin_init("VIN-", ANALOG);

  const i2c_config_t config = {
      .user_data = chip, .address = 0x40,
      .scl = pin_init("SCL", INPUT_PULLUP), .sda = pin_init("SDA", INPUT_PULLUP),
      .connect = on_i2c_connect, .read = on_i2c_read, .write = on_i2c_write,
  };
  i2c_init(&config);

  const timer_config_t timer = {.user_data = chip, .callback = refresh};
  refresh(chip);
  timer_start(timer_init(&timer), 1000, true);
}
