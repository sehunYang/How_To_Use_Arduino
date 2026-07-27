#include "ina219.h"

void ina219_reset(Ina219Registers* regs) {
  regs->config = 0x399F;  // datasheet power-on default
  regs->shuntVoltage = 0;
  regs->busVoltage = 0;
  regs->power = 0;
  regs->current = 0;
  regs->calibration = 0;
}

void ina219_recompute(Ina219Registers* regs) {
  const int32_t shunt = (int16_t)regs->shuntVoltage;
  const int32_t current = (shunt * (int32_t)regs->calibration) / 4096;
  const int32_t power = (current * (int32_t)regs->busVoltage) / 5000;
  regs->current = (uint16_t)current;
  regs->power = (uint16_t)power;
}

void ina219_write_register(Ina219Registers* regs, uint8_t addr, uint16_t value) {
  switch (addr) {
    case INA219_REG_CONFIG:
      regs->config = value;
      break;
    case INA219_REG_CALIBRATION:
      regs->calibration = value;
      ina219_recompute(regs);
      break;
    default:
      break;
  }
}

// Simplification: the real bus-voltage register packs the voltage into bits
// 15:3 with CNVR/OVF flags in the low bits — this model returns it unpacked.
uint16_t ina219_read_register(const Ina219Registers* regs, uint8_t addr) {
  switch (addr) {
    case INA219_REG_CONFIG:
      return regs->config;
    case INA219_REG_SHUNT_VOLTAGE:
      return regs->shuntVoltage;
    case INA219_REG_BUS_VOLTAGE:
      return regs->busVoltage;
    case INA219_REG_POWER:
      return regs->power;
    case INA219_REG_CURRENT:
      return regs->current;
    case INA219_REG_CALIBRATION:
      return regs->calibration;
    default:
      return 0;
  }
}

void ina219_set_raw_measurement(Ina219Registers* regs, int16_t shuntRaw, uint16_t busRaw) {
  regs->shuntVoltage = (uint16_t)shuntRaw;
  regs->busVoltage = busRaw;
  ina219_recompute(regs);
}
