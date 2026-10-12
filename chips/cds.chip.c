#include "wokwi-api.h"
#include "cds.h"

#include <stdlib.h>

// The generator (src/wokwi/phase5ProjectGenerator.ts) checks the recipe's divider
// and sets the attributes: which leg is the analog node, and the fixed resistor.
typedef struct {
  uint32_t lux_attr;
  uint32_t fixed_ohms_attr;
  uint32_t supply_volts_attr;
  pin_t node;
} chip_state_t;

static void refresh(void *user_data) {
  chip_state_t *chip = user_data;
  pin_dac_write(chip->node, (float)cds_divider_volts(
      attr_read_float(chip->lux_attr),
      attr_read_float(chip->supply_volts_attr),
      attr_read_float(chip->fixed_ohms_attr)));
}

void chip_init(void) {
  chip_state_t *chip = calloc(1, sizeof(chip_state_t));
  chip->lux_attr = attr_init_float("lux", 300);
  chip->fixed_ohms_attr = attr_init_float("fixedOhms", 10000);
  chip->supply_volts_attr = attr_init_float("supplyVolts", 5);
  const bool nodeIsL1 = attr_read(attr_init("nodePin", 2)) == 1;
  pin_init(nodeIsL1 ? "L2" : "L1", INPUT);
  chip->node = pin_init(nodeIsL1 ? "L1" : "L2", ANALOG);

  const timer_config_t config = {.user_data = chip, .callback = refresh};
  refresh(chip);
  timer_start(timer_init(&config), 1000, true);
}
