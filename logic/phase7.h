#pragma once

#include <cstddef>

namespace phase7 {

/**
 * Phase 7 출력 장치 예제의 순수 계산 부분.
 *
 * 스케치에서 보드 없이 검증할 수 있는 조각만 뽑았습니다. analogWrite와
 * digitalWrite 자체는 하드웨어이므로, 그 함수에 **무엇을 넘기는지**를 정하는
 * 계산만 여기에서 확인합니다.
 */

/** A1: 0에서 255까지 step 간격으로 오르는 밝기 단계. 마지막 단계가 255를 넘지 않아야 합니다. */
inline int ledStepCount(int step) {
  if (step <= 0) return 0;
  return 255 / step + 1;
}

inline int ledStepValue(int index, int step) {
  const int value = index * step;
  return value > 255 ? 255 : value;
}

/** A1: 주변광을 뺀 보정 조도. 음수는 0으로 자릅니다. */
inline double correctedLight(double raw, double ambient) {
  const double corrected = raw - ambient;
  return corrected < 0.0 ? 0.0 : corrected;
}

/** A2: 진동수를 두 배로 올리면 한 옥타브가 올라갑니다. */
inline int octaveUp(int hertz) { return hertz * 2; }

inline bool sameNoteName(int lowHz, int highHz) {
  if (lowHz <= 0) return false;
  return highHz % lowHz == 0 && (highHz / lowHz) % 2 == 0;
}

/** A3: 0도에서 180도까지 step 간격으로 도는 각도 목록. */
inline int servoSweepCount(int step) {
  if (step <= 0) return 0;
  return 180 / step + 1;
}

inline int servoSweepAngle(int index, int step) {
  const int angle = index * step;
  return angle > 180 ? 180 : angle;
}

/** A4: 켜 두는 시간을 밀리초로. 접점을 아끼려 1초 아래로는 내려가지 않습니다. */
inline unsigned long relayHoldMs(int onSeconds) {
  const int guarded = onSeconds < 1 ? 1 : onSeconds;
  return static_cast<unsigned long>(guarded) * 1000UL;
}

/** A5: 두 방향 입력의 조합이 정하는 회전 방향. 같으면 멈춥니다. */
inline int motorDirection(bool in1, bool in2) {
  if (in1 == in2) return 0;
  return in1 ? 1 : -1;
}

inline int motorSpeed(int requested) {
  if (requested < 0) return 0;
  return requested > 255 ? 255 : requested;
}

/** A6: 화면 한 줄(16칸)에 넘치지 않도록 자른 글자 수. */
inline std::size_t lcdFitsColumns(std::size_t length, std::size_t columns) {
  return length > columns ? columns : length;
}

}  // namespace phase7
