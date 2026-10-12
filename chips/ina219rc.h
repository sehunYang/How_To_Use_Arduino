#ifndef CHIPS_INA219RC_H
#define CHIPS_INA219RC_H

// A capacitor charged from a source through a series resistor and an INA219's
// 0.1 Ω shunt (recipe ph21). Wokwi has no capacitor model, so this chip stands
// in for the INA219 and the capacitor together: it drives the capacitor node
// (VIN-, also wired to an analog pin) and feeds the same charging current to
// the INA219 register model (chips/ina219.c).

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define INA219RC_SHUNT_OHMS 0.1

typedef struct RcBranch {
  double sourceVolts;
  double seriesOhms;
  double capacitanceFarads;
  bool connected;
  // Capacitor voltage and time when the source was last connected or removed.
  double startVolts;
  double startSeconds;
} RcBranch;

void rc_init(RcBranch* rc, double sourceVolts, double seriesOhms, double capacitanceFarads);
double rc_time_constant(const RcBranch* rc);

// Connecting charges toward the source; removing it leaves the charge in place.
void rc_set_connected(RcBranch* rc, bool connected, double nowSeconds);
double rc_capacitor_volts(const RcBranch* rc, double nowSeconds);
double rc_current_amps(const RcBranch* rc, double nowSeconds);

// INA219 conversions the model feeds the register model with.
int16_t rc_shunt_raw(double amps);       // 10 µV per LSB across the shunt
uint16_t rc_bus_register(double volts);  // 4 mV per LSB in bits 15:3

#ifdef __cplusplus
}
#endif

#endif  // CHIPS_INA219RC_H
