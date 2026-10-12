#ifndef CHIPS_MPU6050AUX_H
#define CHIPS_MPU6050AUX_H

// MPU6050 with a TSL2591 on its auxiliary bus (XDA/XCL). Wokwi's own MPU6050 does
// not implement the auxiliary I2C master, and a Wokwi chip cannot drive a second
// bus, so this model carries the TSL2591 (chips/tsl2591.c) itself.
//
// From the InvenSense register map (RM-MPU-6000A rev 4.2):
// - PWR_MGMT_1 (0x6B) resets to 0x40: asleep, data registers frozen at 0.
// - INT_PIN_CFG (0x37) bit 1, I2C_BYPASS_EN: XDA/XCL join the main bus, so the
//   TSL2591 answers at 0x29 directly. Otherwise it is out of the main bus's reach.
// - USER_CTRL (0x6A) bit 5, I2C_MST_EN: once per sample the MPU reads slave 0
//   (I2C_SLV0_ADDR/REG/CTRL, 0x25-0x27) into EXT_SENS_DATA_00.. (0x49..).
// - The sample period is (1 + SMPLRT_DIV) / (8 kHz with DLPF off, else 1 kHz).

#include <stdbool.h>
#include <stdint.h>

#include "tsl2591.h"

#ifdef __cplusplus
extern "C" {
#endif

#define MPU6050_I2C_ADDRESS 0x68

#define MPU6050_REG_SMPLRT_DIV 0x19
#define MPU6050_REG_CONFIG 0x1A
#define MPU6050_REG_ACCEL_CONFIG 0x1C
#define MPU6050_REG_I2C_SLV0_ADDR 0x25
#define MPU6050_REG_I2C_SLV0_REG 0x26
#define MPU6050_REG_I2C_SLV0_CTRL 0x27
#define MPU6050_REG_INT_PIN_CFG 0x37
#define MPU6050_REG_ACCEL_XOUT_H 0x3B
#define MPU6050_REG_TEMP_OUT_H 0x41
#define MPU6050_REG_EXT_SENS_DATA_00 0x49
#define MPU6050_REG_USER_CTRL 0x6A
#define MPU6050_REG_PWR_MGMT_1 0x6B
#define MPU6050_REG_WHO_AM_I 0x75

typedef struct Mpu6050Aux {
  uint8_t regs[128];
  uint8_t pointer;
  bool awaitingRegister;
  // Acceleration in g, as the Wokwi MPU6050's controls take it.
  float accel[3];
  bool tslPresent;
  Tsl2591Registers tsl;
  uint8_t tslPointer;
  bool tslAwaitingRegister;
} Mpu6050Aux;

void mpu6050aux_init(Mpu6050Aux* mpu, bool tslOnAux);
void mpu6050aux_set_accel(Mpu6050Aux* mpu, float x, float y, float z);

// The MPU at 0x68.
void mpu6050aux_connect(Mpu6050Aux* mpu, bool read);
void mpu6050aux_write(Mpu6050Aux* mpu, uint8_t data);
uint8_t mpu6050aux_read(Mpu6050Aux* mpu);

// 0x29 on the main bus: answers only in bypass mode.
bool mpu6050aux_bypass_connect(Mpu6050Aux* mpu, bool read);
void mpu6050aux_bypass_write(Mpu6050Aux* mpu, uint8_t data);
uint8_t mpu6050aux_bypass_read(Mpu6050Aux* mpu);

// One sample period: the auxiliary master's slave-0 read, if configured.
void mpu6050aux_sample(Mpu6050Aux* mpu);
uint32_t mpu6050aux_sample_period_us(const Mpu6050Aux* mpu);

#ifdef __cplusplus
}
#endif

#endif  // CHIPS_MPU6050AUX_H
