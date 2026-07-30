#include "bme280.h"

/*
 * Fixed, datasheet-valid trimming coefficients. They are the Bosch reference
 * example values commonly used to validate the compensation formulas. Keeping
 * them constant makes host tests and simulated sketches deterministic.
 */
static const uint8_t calibration_00[] = {
    0x70, 0x6B,  // dig_T1 = 27504
    0x43, 0x67,  // dig_T2 = 26435
    0x18, 0xFC,  // dig_T3 = -1000
    0x7D, 0x8E,  // dig_P1 = 36477
    0x43, 0xD6,  // dig_P2 = -10685
    0xD0, 0x0B,  // dig_P3 = 3024
    0x27, 0x0B,  // dig_P4 = 2855
    0x8C, 0x00,  // dig_P5 = 140
    0xF9, 0xFF,  // dig_P6 = -7
    0x8C, 0x3C,  // dig_P7 = 15500
    0xF8, 0xC6,  // dig_P8 = -14600
    0x70, 0x17,  // dig_P9 = 6000
    0x00,        // reserved
    0x4B,        // dig_H1 = 75
};

static const uint8_t calibration_26[] = {
    0x6A, 0x01,  // dig_H2 = 362
    0x00,        // dig_H3 = 0
    0x14,        // dig_H4 bits 11:4 (dig_H4 = 334)
    0x2E,        // dig_H5 bits 3:0 | dig_H4 bits 3:0
    0x03,        // dig_H5 bits 11:4 (dig_H5 = 50)
    0x1E,        // dig_H6 = 30
};

void bme280_reset(Bme280Registers* regs) {
  regs->ctrlHum = 0;
  regs->ctrlMeas = 0;
  regs->config = 0;
  regs->rawTemperature = 519888;
  regs->rawPressure = 415148;
  regs->rawHumidity = 30000;
}

void bme280_set_raw_measurement(
    Bme280Registers* regs,
    uint32_t rawTemperature,
    uint32_t rawPressure,
    uint16_t rawHumidity) {
  regs->rawTemperature = rawTemperature & 0xFFFFFu;
  regs->rawPressure = rawPressure & 0xFFFFFu;
  regs->rawHumidity = rawHumidity;
}

void bme280_write_register(Bme280Registers* regs, uint8_t addr, uint8_t value) {
  switch (addr) {
    case BME280_REG_RESET:
      if (value == BME280_RESET_COMMAND) {
        bme280_reset(regs);
      }
      break;
    case BME280_REG_CTRL_HUM:
      regs->ctrlHum = value & 0x07u;
      break;
    case BME280_REG_CTRL_MEAS:
      regs->ctrlMeas = value;
      break;
    case BME280_REG_CONFIG:
      regs->config = value;
      break;
    default:
      break;
  }
}

static uint8_t read_measurement(const Bme280Registers* regs, uint8_t offset) {
  switch (offset) {
    case 0:
      return (uint8_t)(regs->rawPressure >> 12);
    case 1:
      return (uint8_t)(regs->rawPressure >> 4);
    case 2:
      return (uint8_t)(regs->rawPressure << 4);
    case 3:
      return (uint8_t)(regs->rawTemperature >> 12);
    case 4:
      return (uint8_t)(regs->rawTemperature >> 4);
    case 5:
      return (uint8_t)(regs->rawTemperature << 4);
    case 6:
      return (uint8_t)(regs->rawHumidity >> 8);
    default:
      return (uint8_t)regs->rawHumidity;
  }
}

uint8_t bme280_read_register(const Bme280Registers* regs, uint8_t addr) {
  if (addr >= BME280_REG_CALIB00 &&
      addr < BME280_REG_CALIB00 + sizeof(calibration_00)) {
    return calibration_00[addr - BME280_REG_CALIB00];
  }
  if (addr >= BME280_REG_CALIB26 &&
      addr < BME280_REG_CALIB26 + sizeof(calibration_26)) {
    return calibration_26[addr - BME280_REG_CALIB26];
  }
  if (addr >= BME280_REG_PRESS_MSB && addr <= BME280_REG_PRESS_MSB + 7) {
    return read_measurement(regs, addr - BME280_REG_PRESS_MSB);
  }

  switch (addr) {
    case BME280_REG_ID:
      return BME280_CHIP_ID;
    case BME280_REG_STATUS:
      return 0;  // conversions complete immediately in this deterministic model
    case BME280_REG_CTRL_HUM:
      return regs->ctrlHum;
    case BME280_REG_CTRL_MEAS:
      return regs->ctrlMeas;
    case BME280_REG_CONFIG:
      return regs->config;
    default:
      return 0;
  }
}
