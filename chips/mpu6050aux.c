#include "mpu6050aux.h"

#include <string.h>

#define PWR_SLEEP 0x40
#define INT_PIN_BYPASS 0x02
#define USER_MST_EN 0x20
#define SLV_READ 0x80
#define SLV_EN 0x80
#define SLV_LEN_MASK 0x0F
#define EXT_SENS_DATA_COUNT 24

static bool awake(const Mpu6050Aux* mpu) { return !(mpu->regs[MPU6050_REG_PWR_MGMT_1] & PWR_SLEEP); }

static void put16(uint8_t* at, int32_t value) {
  if (value > 32767) value = 32767;
  if (value < -32768) value = -32768;
  at[0] = (uint8_t)((uint16_t)value >> 8);
  at[1] = (uint8_t)value;
}

// Sensor registers follow the controls only while awake, at the selected range.
static void refresh_data(Mpu6050Aux* mpu) {
  uint8_t* data = &mpu->regs[MPU6050_REG_ACCEL_XOUT_H];
  if (!awake(mpu)) return;
  const float lsbPerG = (float)(16384 >> ((mpu->regs[MPU6050_REG_ACCEL_CONFIG] >> 3) & 3));
  for (int axis = 0; axis < 3; axis++) {
    const float counts = mpu->accel[axis] * lsbPerG;
    put16(&data[2 * axis], (int32_t)(counts < 0 ? counts - 0.5f : counts + 0.5f));
  }
  // 25 °C: TEMP_OUT = (25 - 36.53) * 340.
  put16(&mpu->regs[MPU6050_REG_TEMP_OUT_H], -3920);
}

void mpu6050aux_init(Mpu6050Aux* mpu, bool tslOnAux) {
  memset(mpu, 0, sizeof *mpu);
  mpu->regs[MPU6050_REG_PWR_MGMT_1] = PWR_SLEEP;
  mpu->regs[MPU6050_REG_WHO_AM_I] = MPU6050_I2C_ADDRESS;
  mpu->accel[2] = 1.0f;
  mpu->tslPresent = tslOnAux;
  tsl2591_reset(&mpu->tsl);
}

void mpu6050aux_set_accel(Mpu6050Aux* mpu, float x, float y, float z) {
  mpu->accel[0] = x;
  mpu->accel[1] = y;
  mpu->accel[2] = z;
  refresh_data(mpu);
}

void mpu6050aux_connect(Mpu6050Aux* mpu, bool read) {
  mpu->awaitingRegister = !read;
  if (read) refresh_data(mpu);
}

static bool read_only(uint8_t reg) {
  return (reg >= MPU6050_REG_ACCEL_XOUT_H && reg < MPU6050_REG_EXT_SENS_DATA_00 + EXT_SENS_DATA_COUNT)
      || reg == MPU6050_REG_WHO_AM_I;
}

void mpu6050aux_write(Mpu6050Aux* mpu, uint8_t data) {
  if (mpu->awaitingRegister) {
    mpu->pointer = data & 0x7f;
    mpu->awaitingRegister = false;
    return;
  }
  const uint8_t reg = mpu->pointer;
  mpu->pointer = (mpu->pointer + 1) & 0x7f;
  if (read_only(reg)) return;
  // DEVICE_RESET (bit 7) restores the power-on state.
  if (reg == MPU6050_REG_PWR_MGMT_1 && (data & 0x80)) {
    mpu6050aux_init(mpu, mpu->tslPresent);
    return;
  }
  mpu->regs[reg] = data;
  refresh_data(mpu);
}

uint8_t mpu6050aux_read(Mpu6050Aux* mpu) {
  const uint8_t value = mpu->regs[mpu->pointer];
  mpu->pointer = (mpu->pointer + 1) & 0x7f;
  return value;
}

static bool bypassed(const Mpu6050Aux* mpu) {
  return mpu->tslPresent && (mpu->regs[MPU6050_REG_INT_PIN_CFG] & INT_PIN_BYPASS);
}

bool mpu6050aux_bypass_connect(Mpu6050Aux* mpu, bool read) {
  if (!bypassed(mpu)) return false;
  mpu->tslAwaitingRegister = !read;
  return true;
}

// Same framing as chips/tsl2591.chip.c: a COMMAND byte selects the register.
void mpu6050aux_bypass_write(Mpu6050Aux* mpu, uint8_t data) {
  if (mpu->tslAwaitingRegister) {
    mpu->tslPointer = data & 0x1f;
    mpu->tslAwaitingRegister = false;
  } else {
    tsl2591_write_register(&mpu->tsl, mpu->tslPointer, data);
    mpu->tslPointer++;
  }
}

uint8_t mpu6050aux_bypass_read(Mpu6050Aux* mpu) {
  return tsl2591_read_register(&mpu->tsl, mpu->tslPointer++);
}

void mpu6050aux_sample(Mpu6050Aux* mpu) {
  const uint8_t* r = mpu->regs;
  if (!awake(mpu) || !(r[MPU6050_REG_USER_CTRL] & USER_MST_EN)) return;
  const uint8_t ctrl = r[MPU6050_REG_I2C_SLV0_CTRL];
  const uint8_t addr = r[MPU6050_REG_I2C_SLV0_ADDR];
  if (!(ctrl & SLV_EN) || !(addr & SLV_READ)) return;
  const uint8_t length = ctrl & SLV_LEN_MASK;
  // A slave that does not answer leaves EXT_SENS_DATA as it was.
  if (!mpu->tslPresent || (addr & 0x7f) != TSL2591_I2C_ADDRESS) return;
  uint8_t reg = r[MPU6050_REG_I2C_SLV0_REG] & 0x1f;
  for (uint8_t i = 0; i < length && i < EXT_SENS_DATA_COUNT; i++) {
    mpu->regs[MPU6050_REG_EXT_SENS_DATA_00 + i] = tsl2591_read_register(&mpu->tsl, reg++);
  }
}

uint32_t mpu6050aux_sample_period_us(const Mpu6050Aux* mpu) {
  const uint8_t dlpf = mpu->regs[MPU6050_REG_CONFIG] & 0x07;
  const uint32_t gyroRateUs = (dlpf == 0 || dlpf == 7) ? 125 : 1000;
  return gyroRateUs * (1u + mpu->regs[MPU6050_REG_SMPLRT_DIV]);
}
