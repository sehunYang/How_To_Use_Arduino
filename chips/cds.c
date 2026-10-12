#include "cds.h"

#include <math.h>

double cds_resistance_ohms(double lux) {
  if (lux <= 0) return CDS_DARK_OHMS;
  const double ohms = CDS_R10_OHMS * pow(lux / 10.0, -CDS_GAMMA);
  return ohms > CDS_DARK_OHMS ? CDS_DARK_OHMS : ohms;
}

double cds_divider_volts(double lux, double supplyVolts, double fixedOhms) {
  return supplyVolts * fixedOhms / (fixedOhms + cds_resistance_ohms(lux));
}
