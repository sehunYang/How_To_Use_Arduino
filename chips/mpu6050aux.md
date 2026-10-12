# MPU6050 auxiliary-bus Wokwi chip

Wokwi's MPU6050 part does not implement the auxiliary I2C master (XDA/XCL), and a
Wokwi custom chip cannot drive a second bus. For recipes that hang a TSL2591 on
the auxiliary bus, the generator (`withAuxMpuChips` in
`src/wokwi/phase5ProjectGenerator.ts`) swaps the MPU6050 for this chip and
folds the TSL2591 into it (`chips/tsl2591.c`, the standalone chip's model).
MPU6050s with nothing on XDA/XCL keep Wokwi's own part.

Controls: `accelX`/`accelY`/`accelZ` in g, as on Wokwi's MPU6050, and
`ch0Raw`/`ch1Raw` for the TSL2591, as on the TSL2591 chip.

Modelled from the InvenSense register map:

- Power-on asleep (PWR_MGMT_1 = 0x40); WHO_AM_I = 0x68; accelerometer at the
  ACCEL_CONFIG range; temperature fixed at 25 °C; gyro at rest.
- INT_PIN_CFG.I2C_BYPASS_EN joins the auxiliary bus to the main bus, so the
  TSL2591 answers 0x29 directly only then. A sketch that powers the sensor up
  without bypass never reaches it, and reads 0 later.
- With USER_CTRL.I2C_MST_EN, slave 0 (I2C_SLV0_ADDR/REG/CTRL) is read into
  EXT_SENS_DATA once per sample period, (1 + SMPLRT_DIV) × 125 µs with the DLPF
  off or × 1 ms with it on. A sketch reading before the first sample gets stale
  data.

Not modelled: slaves 1-4, writes through the master, gyro and FIFO data,
interrupts, the DMP, and AD0 high (the generator rejects it).
