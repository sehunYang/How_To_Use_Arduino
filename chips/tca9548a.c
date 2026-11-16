#include "tca9548a.h"

void tca9548a_init(Tca9548a* mux, uint8_t tslMask) {
  mux->control = 0;
  mux->tslMask = tslMask;
  mux->inReset = false;
  for (int channel = 0; channel < TCA9548A_CHANNELS; channel++) {
    tsl2591_reset(&mux->tsl[channel].registers);
    mux->tsl[channel].pointer = 0;
    mux->tsl[channel].awaitingRegister = false;
  }
}

void tca9548a_set_reset(Tca9548a* mux, bool low) {
  mux->inReset = low;
  if (low) mux->control = 0;
}

bool tca9548a_connect(const Tca9548a* mux) { return !mux->inReset; }

void tca9548a_write_control(Tca9548a* mux, uint8_t value) {
  if (!mux->inReset) mux->control = value;
}

uint8_t tca9548a_read_control(const Tca9548a* mux) { return mux->control; }

uint8_t tca9548a_open_sensors(const Tca9548a* mux) {
  return mux->inReset ? 0 : (uint8_t)(mux->control & mux->tslMask);
}

bool tca9548a_tsl_connect(Tca9548a* mux, bool read) {
  const uint8_t open = tca9548a_open_sensors(mux);
  for (int channel = 0; channel < TCA9548A_CHANNELS; channel++) {
    if (open & (1u << channel)) mux->tsl[channel].awaitingRegister = !read;
  }
  return open != 0;
}

// Same framing as chips/tsl2591.chip.c: the first byte of a write is the
// COMMAND byte, whose low five bits select the register.
void tca9548a_tsl_write(Tca9548a* mux, uint8_t data) {
  const uint8_t open = tca9548a_open_sensors(mux);
  for (int channel = 0; channel < TCA9548A_CHANNELS; channel++) {
    if (!(open & (1u << channel))) continue;
    Tca9548aDownstream* tsl = &mux->tsl[channel];
    if (tsl->awaitingRegister) {
      tsl->pointer = data & 0x1f;
      tsl->awaitingRegister = false;
    } else {
      tsl2591_write_register(&tsl->registers, tsl->pointer, data);
      tsl->pointer++;
    }
  }
}

uint8_t tca9548a_tsl_read(Tca9548a* mux) {
  const uint8_t open = tca9548a_open_sensors(mux);
  uint8_t bus = 0xff;
  for (int channel = 0; channel < TCA9548A_CHANNELS; channel++) {
    if (!(open & (1u << channel))) continue;
    Tca9548aDownstream* tsl = &mux->tsl[channel];
    bus &= tsl2591_read_register(&tsl->registers, tsl->pointer);
    tsl->pointer++;
  }
  return bus;
}
