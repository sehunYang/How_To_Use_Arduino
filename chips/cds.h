#ifndef CHIPS_CDS_H
#define CHIPS_CDS_H

// CdS photoresistor (GL5528 class) in a voltage divider. The recipes wire one leg
// to 5 V and the other to an analog pin that a fixed resistor pulls to GND, so the
// pin reads supply * fixed / (fixed + R_cds). This is the model the Wokwi chip
// drives onto that pin; src/wokwi/sensorOracles.ts states the same law
// independently so a sketch that reads the divider wrongly disagrees with it.

#ifdef __cplusplus
extern "C" {
#endif

// GL5528 datasheet: 10-20 kOhm at 10 lux, gamma (10-100 lux) 0.7, dark >= 1 MOhm.
#define CDS_R10_OHMS 15000.0
#define CDS_GAMMA 0.7
#define CDS_DARK_OHMS 1000000.0

// Resistance at `lux`: R10 * (lux / 10)^-gamma, never above the dark resistance.
double cds_resistance_ohms(double lux);

// Divider output with the photoresistor on the supply side.
double cds_divider_volts(double lux, double supplyVolts, double fixedOhms);

#ifdef __cplusplus
}
#endif

#endif  // CHIPS_CDS_H
