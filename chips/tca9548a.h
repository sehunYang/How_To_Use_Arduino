#ifndef CHIPS_TCA9548A_H
#define CHIPS_TCA9548A_H

// TCA9548A 1-to-8 I2C switch with a TSL2591 on any of its channels. A Wokwi chip
// cannot be an I2C master, so it cannot pass a transaction on to separate sensor
// chips; this model carries the downstream TSL2591s itself (chips/tsl2591.c).
//
// Behaviour from the TI datasheet (SCPS207):
// - The control register is one byte, one bit per channel; any number of
//   channels may be open at once. A read returns it.
// - RESET low clears the control register and the device ignores the bus.
// - Downstream devices share SDA through the switch, so two open channels that
//   both answer the same address collide. SDA is open-drain, so the master reads
//   the AND of what both drive.

#include <stdbool.h>
#include <stdint.h>

#include "tsl2591.h"

#ifdef __cplusplus
extern "C" {
#endif

#define TCA9548A_CHANNELS 8
#define TCA9548A_BASE_ADDRESS 0x70

typedef struct Tca9548aDownstream {
  Tsl2591Registers registers;
  uint8_t pointer;
  bool awaitingRegister;
} Tca9548aDownstream;

typedef struct Tca9548a {
  uint8_t control;
  // Channels with a TSL2591 wired to them.
  uint8_t tslMask;
  bool inReset;
  Tca9548aDownstream tsl[TCA9548A_CHANNELS];
} Tca9548a;

void tca9548a_init(Tca9548a* mux, uint8_t tslMask);

// RESET pin level: low clears the selection and holds the device off the bus.
void tca9548a_set_reset(Tca9548a* mux, bool low);

// The switch's own address: false NACKs (held in reset).
bool tca9548a_connect(const Tca9548a* mux);
void tca9548a_write_control(Tca9548a* mux, uint8_t value);
uint8_t tca9548a_read_control(const Tca9548a* mux);

// Channels whose TSL2591 currently sees the main bus.
uint8_t tca9548a_open_sensors(const Tca9548a* mux);

// A transaction to 0x29: reaches every open TSL2591. False NACKs (none open).
bool tca9548a_tsl_connect(Tca9548a* mux, bool read);
void tca9548a_tsl_write(Tca9548a* mux, uint8_t data);
uint8_t tca9548a_tsl_read(Tca9548a* mux);

#ifdef __cplusplus
}
#endif

#endif  // CHIPS_TCA9548A_H
