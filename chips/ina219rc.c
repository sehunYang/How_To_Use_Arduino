#include "ina219rc.h"

#include <math.h>

void rc_init(RcBranch* rc, double sourceVolts, double seriesOhms, double capacitanceFarads) {
  rc->sourceVolts = sourceVolts;
  rc->seriesOhms = seriesOhms;
  rc->capacitanceFarads = capacitanceFarads;
  rc->connected = false;
  rc->startVolts = 0;
  rc->startSeconds = 0;
}

double rc_time_constant(const RcBranch* rc) {
  return (rc->seriesOhms + INA219RC_SHUNT_OHMS) * rc->capacitanceFarads;
}

double rc_capacitor_volts(const RcBranch* rc, double nowSeconds) {
  if (!rc->connected) return rc->startVolts;
  const double elapsed = nowSeconds - rc->startSeconds;
  return rc->sourceVolts - (rc->sourceVolts - rc->startVolts) * exp(-elapsed / rc_time_constant(rc));
}

void rc_set_connected(RcBranch* rc, bool connected, double nowSeconds) {
  if (connected == rc->connected) return;
  rc->startVolts = rc_capacitor_volts(rc, nowSeconds);
  rc->startSeconds = nowSeconds;
  rc->connected = connected;
}

double rc_current_amps(const RcBranch* rc, double nowSeconds) {
  if (!rc->connected) return 0;
  return (rc->sourceVolts - rc_capacitor_volts(rc, nowSeconds)) / (rc->seriesOhms + INA219RC_SHUNT_OHMS);
}

int16_t rc_shunt_raw(double amps) {
  const double raw = round(amps * INA219RC_SHUNT_OHMS / 10e-6);
  return (int16_t)(raw > 32767 ? 32767 : raw < -32768 ? -32768 : raw);
}

uint16_t rc_bus_register(double volts) {
  const double counts = round((volts < 0 ? 0 : volts) / 0.004);
  return (uint16_t)((counts > 4095 ? 4095 : counts)) << 3;
}
