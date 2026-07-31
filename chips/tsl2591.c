#include "tsl2591.h"

#define TSL2591_FULL_SCALE 0xFFFFu

void tsl2591_reset(Tsl2591Registers* regs) {
  regs->enable = 0;
  regs->config = 0;
  regs->ch0 = 0;
  regs->ch1 = 0;
  regs->lowThreshold = 0;
  regs->highThreshold = 0xffff;
  regs->rawCh0 = 0;
  regs->rawCh1 = 0;
}

uint16_t tsl2591_gain_multiplier(uint8_t config) {
  switch ((config & TSL2591_CONFIG_GAIN_MASK) >> TSL2591_CONFIG_GAIN_SHIFT) {
    case 0:
      return 1;
    case 1:
      return 25;
    case 2:
      return 428;
    default:
      return 9876;
  }
}

uint8_t tsl2591_integration_multiplier(uint8_t config) {
  const uint8_t atime = config & TSL2591_CONFIG_ATIME_MASK;
  return (uint8_t)((atime > 5 ? 5 : atime) + 1);
}

static uint16_t scale_channel(uint32_t raw, uint32_t factor) {
  const uint64_t counts = (uint64_t)raw * factor;
  return counts > TSL2591_FULL_SCALE ? (uint16_t)TSL2591_FULL_SCALE : (uint16_t)counts;
}

void tsl2591_recompute(Tsl2591Registers* regs) {
  const uint8_t running = TSL2591_ENABLE_PON | TSL2591_ENABLE_AEN;
  if ((regs->enable & running) != running) {
    regs->ch0 = 0;
    regs->ch1 = 0;
    return;
  }
  const uint32_t factor =
      (uint32_t)tsl2591_gain_multiplier(regs->config) * tsl2591_integration_multiplier(regs->config);
  regs->ch0 = scale_channel(regs->rawCh0, factor);
  regs->ch1 = scale_channel(regs->rawCh1, factor);
}

// Simplification: the real I2C protocol prefixes every register access with a
// COMMAND byte (0xA0 | register); this model takes the bare register address
// and does not implement that transaction framing.
void tsl2591_write_register(Tsl2591Registers* regs, uint8_t addr, uint8_t value) {
  switch (addr) {
    case TSL2591_REG_ENABLE:
      regs->enable = value;
      tsl2591_recompute(regs);
      break;
    case TSL2591_REG_CONFIG:
      regs->config = value;
      tsl2591_recompute(regs);
      break;
    case TSL2591_REG_AILTL:
      regs->lowThreshold = (regs->lowThreshold & 0xff00u) | value;
      break;
    case TSL2591_REG_AILTH:
      regs->lowThreshold = (regs->lowThreshold & 0x00ffu) | ((uint16_t)value << 8);
      break;
    case TSL2591_REG_AIHTL:
      regs->highThreshold = (regs->highThreshold & 0xff00u) | value;
      break;
    case TSL2591_REG_AIHTH:
      regs->highThreshold = (regs->highThreshold & 0x00ffu) | ((uint16_t)value << 8);
      break;
    default:
      break;
  }
}

uint8_t tsl2591_read_register(const Tsl2591Registers* regs, uint8_t addr) {
  switch (addr) {
    case TSL2591_REG_ENABLE:
      return regs->enable;
    case TSL2591_REG_CONFIG:
      return regs->config;
    case TSL2591_REG_AILTL:
      return (uint8_t)(regs->lowThreshold & 0xff);
    case TSL2591_REG_AILTH:
      return (uint8_t)(regs->lowThreshold >> 8);
    case TSL2591_REG_AIHTL:
      return (uint8_t)(regs->highThreshold & 0xff);
    case TSL2591_REG_AIHTH:
      return (uint8_t)(regs->highThreshold >> 8);
    case TSL2591_REG_STATUS:
      return (regs->enable & TSL2591_ENABLE_AIEN)
          && (regs->ch0 < regs->lowThreshold || regs->ch0 > regs->highThreshold)
        ? 0x10
        : 0;
    case TSL2591_REG_C0DATAL:
      return (uint8_t)(regs->ch0 & 0xFF);
    case TSL2591_REG_C0DATAH:
      return (uint8_t)(regs->ch0 >> 8);
    case TSL2591_REG_C1DATAL:
      return (uint8_t)(regs->ch1 & 0xFF);
    case TSL2591_REG_C1DATAH:
      return (uint8_t)(regs->ch1 >> 8);
    default:
      return 0;
  }
}

void tsl2591_set_raw_counts(Tsl2591Registers* regs, uint32_t rawCh0, uint32_t rawCh1) {
  regs->rawCh0 = rawCh0;
  regs->rawCh1 = rawCh1;
  tsl2591_recompute(regs);
}
