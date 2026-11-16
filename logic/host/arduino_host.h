#ifndef LOGIC_HOST_ARDUINO_HOST_H
#define LOGIC_HOST_ARDUINO_HOST_H

// A stand-in Arduino core that runs a recipe's unmodified sketch on the build
// machine against a virtual clock (scripts/verify-sketch-host.ts). It is for
// sketches whose behaviour plays out over minutes (PIR warm-up and hold times),
// which would cost too much Wokwi time. delay() advances the clock instead of
// waiting, so a ten-minute scenario runs in milliseconds.
//
// Timing that shapes a sketch's output is modelled: analogRead() takes 112 µs,
// and Serial sends one byte per 1.04 ms at 9600 baud through a 64-byte buffer,
// blocking when it is full, as HardwareSerial does.
//
// Not modelled: AVR integer widths (int is 32 bits here), interrupts, I2C/SPI.
//
// Command line: <end_ms> then any of
//   D2@33000=1          digital input level from that time on
//   A0@0=812            analogRead() value from that time on
//   A0+150:D7           add 150 to analogRead(A0) while output D7 is HIGH
//   trace=D9            write each change of output D9 to stderr as `us,pin,value`

#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef uint8_t byte;
typedef bool boolean;

#define HIGH 1
#define LOW 0
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLUP 2
#define A0 14
#define A1 15
#define A2 16
#define A3 17
#define A4 18
#define A5 19
#define DEC 10
#define HEX 16
#define F(text) (text)
#define abs(x) ((x) > 0 ? (x) : -(x))
#define constrain(amt, low, high) ((amt) < (low) ? (low) : ((amt) > (high) ? (high) : (amt)))
#ifndef min
#define min(a, b) ((a) < (b) ? (a) : (b))
#define max(a, b) ((a) > (b) ? (a) : (b))
#endif

namespace host {

const int PINS = 20;
const int MAX_EVENTS = 4096;

struct Event {
  uint64_t atUs;
  int pin;
  int value;
};

struct Feedback {
  int analogPin;
  int add;
  int outputPin;
};

inline uint64_t& now() { static uint64_t us = 0; return us; }
inline Event* events() { static Event list[MAX_EVENTS]; return list; }
inline int& eventCount() { static int count = 0; return count; }
inline Feedback* feedback() { static Feedback list[8]; return list; }
inline int& feedbackCount() { static int count = 0; return count; }
inline int* outputs() { static int levels[PINS]; return levels; }
inline bool* traced() { static bool pins[PINS]; return pins; }
inline uint64_t& txIdleAt() { static uint64_t us = 0; return us; }

// analogRead() takes A0-A5 or the channel numbers 0-5.
inline int analogIndex(int pin) { return pin >= 0 && pin < 6 ? pin + A0 : pin; }

// The input level of `pin` at the current time: the last event at or before now.
inline int inputLevel(int pin, int otherwise) {
  int level = otherwise;
  uint64_t latest = 0;
  bool found = false;
  for (int i = 0; i < eventCount(); i++) {
    const Event& e = events()[i];
    if (e.pin == pin && e.atUs <= now() && (!found || e.atUs >= latest)) {
      latest = e.atUs;
      level = e.value;
      found = true;
    }
  }
  return level;
}

inline int parsePin(const char* text) {
  if (text[0] == 'A') return A0 + atoi(text + 1);
  if (text[0] == 'D') return atoi(text + 1);
  fprintf(stderr, "bad pin %s\n", text);
  exit(2);
}

inline void parse(int argc, char** argv) {
  for (int i = 2; i < argc; i++) {
    const char* arg = argv[i];
    if (strncmp(arg, "trace=", 6) == 0) {
      traced()[parsePin(arg + 6)] = true;
    } else if (strchr(arg, '@')) {
      Event e;
      e.pin = parsePin(arg);
      e.atUs = (uint64_t)strtoull(strchr(arg, '@') + 1, nullptr, 10) * 1000;
      e.value = atoi(strchr(arg, '=') + 1);
      if (eventCount() == MAX_EVENTS) { fprintf(stderr, "too many events\n"); exit(2); }
      events()[eventCount()++] = e;
    } else if (strchr(arg, '+') && strchr(arg, ':')) {
      Feedback f;
      f.analogPin = parsePin(arg);
      f.add = atoi(strchr(arg, '+') + 1);
      f.outputPin = parsePin(strchr(arg, ':') + 1);
      feedback()[feedbackCount()++] = f;
    } else {
      fprintf(stderr, "bad argument %s\n", arg);
      exit(2);
    }
  }
}

// One byte through HardwareSerial: wait while 64 bytes are already queued.
inline void txByte(char c) {
  const uint64_t byteUs = 1042;
  if (txIdleAt() > now() + 64 * byteUs) now() = txIdleAt() - 64 * byteUs;
  txIdleAt() = (txIdleAt() > now() ? txIdleAt() : now()) + byteUs;
  fputc(c, stdout);
}

}  // namespace host

inline unsigned long millis() { return (unsigned long)(host::now() / 1000); }
inline unsigned long micros() { return (unsigned long)host::now(); }
inline void delay(unsigned long ms) { host::now() += (uint64_t)ms * 1000; }
inline void delayMicroseconds(unsigned int us) { host::now() += us; }
inline void pinMode(int, int) {}

inline int digitalRead(int pin) {
  host::now() += 4;
  return host::inputLevel(pin, LOW) ? HIGH : LOW;
}

inline void digitalWrite(int pin, int value) {
  host::now() += 4;
  const int index = pin;
  const int level = value ? HIGH : LOW;
  if (host::traced()[index] && host::outputs()[index] != level) {
    fprintf(stderr, "%llu,%d,%d\n", (unsigned long long)host::now(), index, level);
  }
  host::outputs()[index] = level;
}

inline void analogWrite(int pin, int value) { digitalWrite(pin, value > 127 ? HIGH : LOW); }

inline int analogRead(int pin) {
  host::now() += 112;
  const int index = host::analogIndex(pin);
  int value = host::inputLevel(index, 0);
  for (int i = 0; i < host::feedbackCount(); i++) {
    const host::Feedback& f = host::feedback()[i];
    if (f.analogPin == index && host::outputs()[f.outputPin] == HIGH) value += f.add;
  }
  return constrain(value, 0, 1023);
}

class HostSerial {
 public:
  void begin(unsigned long) {}
  size_t print(const char* text) {
    size_t n = 0;
    for (; text[n]; n++) host::txByte(text[n]);
    return n;
  }
  size_t print(char c) { host::txByte(c); return 1; }
  size_t print(int value, int base = DEC) { return print((long)value, base); }
  size_t print(unsigned int value, int base = DEC) { return print((unsigned long)value, base); }
  size_t print(bool value) { return print((int)value); }
  size_t print(unsigned char value, int base = DEC) { return print((unsigned long)value, base); }
  size_t print(long value, int base = DEC) {
    char text[40];
    if (base == HEX) snprintf(text, sizeof text, "%lx", value);
    else snprintf(text, sizeof text, "%ld", value);
    return print(text);
  }
  size_t print(unsigned long value, int base = DEC) {
    char text[40];
    snprintf(text, sizeof text, base == HEX ? "%lx" : "%lu", value);
    return print(text);
  }
  // Print::printFloat: round half away at the last digit, then integer and digits.
  size_t print(double value, int digits = 2) {
    if (isnan(value)) return print("nan");
    if (isinf(value)) return print("inf");
    if (value > 4294967040.0 || value < -4294967040.0) return print("ovf");
    size_t n = 0;
    if (value < 0) { n += print('-'); value = -value; }
    double rounding = 0.5;
    for (int i = 0; i < digits; i++) rounding /= 10.0;
    value += rounding;
    const unsigned long whole = (unsigned long)value;
    n += print(whole);
    double rest = value - (double)whole;
    if (digits > 0) n += print('.');
    while (digits-- > 0) {
      rest *= 10.0;
      const unsigned int digit = (unsigned int)rest;
      n += print(digit);
      rest -= digit;
    }
    return n;
  }
  size_t println() { return print("\r\n"); }
  template <typename T> size_t println(T value) { size_t n = print(value); return n + println(); }
  template <typename T> size_t println(T value, int format) { size_t n = print(value, format); return n + println(); }
};

static HostSerial Serial;

void setup();
void loop();

int main(int argc, char** argv) {
  if (argc < 2) {
    fprintf(stderr, "usage: %s <end_ms> [events...]\n", argv[0]);
    return 2;
  }
  const uint64_t endUs = (uint64_t)strtoull(argv[1], nullptr, 10) * 1000;
  host::parse(argc, argv);
  setup();
  while (host::now() < endUs) {
    const uint64_t before = host::now();
    loop();
    // A loop() that never waits still costs time on a real board.
    if (host::now() == before) host::now() += 10;
  }
  fflush(stdout);
  return 0;
}

#endif  // LOGIC_HOST_ARDUINO_HOST_H
