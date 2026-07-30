#ifndef CHIPS_BME280_H
#define CHIPS_BME280_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define BME280_I2C_ADDRESS_PRIMARY 0x76
#define BME280_I2C_ADDRESS_SECONDARY 0x77

#define BME280_REG_CALIB00 0x88
#define BME280_REG_ID 0xD0
#define BME280_REG_RESET 0xE0
#define BME280_REG_CALIB26 0xE1
#define BME280_REG_CTRL_HUM 0xF2
#define BME280_REG_STATUS 0xF3
#define BME280_REG_CTRL_MEAS 0xF4
#define BME280_REG_CONFIG 0xF5
#define BME280_REG_PRESS_MSB 0xF7

#define BME280_CHIP_ID 0x60
#define BME280_RESET_COMMAND 0xB6

typedef struct Bme280Registers {
  uint8_t ctrlHum;
  uint8_t ctrlMeas;
  uint8_t config;
  uint32_t rawTemperature;
  uint32_t rawPressure;
  uint16_t rawHumidity;
} Bme280Registers;

void bme280_reset(Bme280Registers* regs);
void bme280_set_raw_measurement(
    Bme280Registers* regs,
    uint32_t rawTemperature,
    uint32_t rawPressure,
    uint16_t rawHumidity);
void bme280_write_register(Bme280Registers* regs, uint8_t addr, uint8_t value);
uint8_t bme280_read_register(const Bme280Registers* regs, uint8_t addr);

#ifdef __cplusplus
}
#endif

#endif  // CHIPS_BME280_H
