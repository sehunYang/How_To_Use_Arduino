#pragma once

#include <cmath>
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

// ── B 묶음 · 생물 ─────────────────────────────────────────────────────────
//
// 생물 탐구의 계산은 거의 모두 "대조군을 뺀 나머지"입니다. 배경 신호를 빼는
// 자리를 스케치가 아니라 여기에 두면, 기준을 바꿔도 다시 측정하지 않습니다.

/** B1: 압력 상승 기울기(hPa/분). 시간이 0이면 기울기를 말할 수 없습니다. */
inline double pressureSlope(double deltaHpa, double minutes) {
  if (minutes <= 0.0) return 0.0;
  return deltaHpa / minutes;
}

/** B1·B3: 대조군 기울기를 뺀 몫. 음수는 그대로 둡니다(호흡은 실제로 음수). */
inline double netSlope(double sample, double control) { return sample - control; }

/** B2: 잎 넓이로 나눈 증산 세기. 넓이를 모르면 비교할 수 없으므로 0을 돌려줍니다. */
inline double transpirationPerArea(double slopePercentPerMin, double areaCm2) {
  if (areaCm2 <= 0.0) return 0.0;
  return slopePercentPerMin / areaCm2;
}

/** B3: 더 밝게 해도 기울기가 tol 이상 늘지 않으면 빛 포화로 봅니다. */
inline bool isLightSaturated(double slopeLower, double slopeHigher, double tol) {
  return slopeHigher - slopeLower < tol;
}

/**
 * B4: 쓸 수 있는 반응 시행인지. 기다림이 끝나 버린 시행과 사람이 도달할 수
 * 없는 시행을 모두 버립니다. 버린 이유를 남길 수 있도록 판정만 합니다.
 */
inline bool isUsableReaction(long reactionMs, long timeoutMs, long humanFloorMs) {
  return reactionMs > humanFloorMs && reactionMs < timeoutMs;
}

/**
 * B5: 문턱값을 넘는 봉우리를 걸음으로 셉니다. 최소 간격이 없으면 한 걸음의
 * 흔들림이 두 번 세어져 실제의 두 배가 나옵니다.
 */
inline int countSteps(const double* magnitudes, std::size_t count, double threshold,
                      unsigned long minGapMs, unsigned long intervalMs) {
  int steps = 0;
  bool above = false;
  unsigned long sinceLast = minGapMs;
  for (std::size_t i = 0; i < count; ++i) {
    sinceLast += intervalMs;
    if (magnitudes[i] > threshold) {
      if (!above && sinceLast >= minGapMs) {
        ++steps;
        sinceLast = 0;
      }
      above = true;
    } else {
      above = false;
    }
  }
  return steps;
}

/** B6: 안정 상태를 뺀 초과 온도. 음수는 0으로 자르지 않습니다(식은 것도 자료). */
inline double excessTemperature(double skinC, double baselineC) { return skinC - baselineC; }

/** B6: 로그 기울기의 역수가 회복 시간상수입니다. 기울기가 0 이상이면 회복이 아닙니다. */
inline double recoveryTimeConstant(double logSlopePerMin) {
  if (logSlopePerMin >= 0.0) return 0.0;
  return -1.0 / logSlopePerMin;
}

/** B7: 두 CDS의 개체 차이를 영점으로 뺀 밝기 기울기. */
inline int gradientError(int leftAdc, int rightAdc, int zeroOffset) {
  return (leftAdc - rightAdc) - zeroOffset;
}

/** B8: 기준 온도를 넘은 몫만 쌓습니다. 기준 아래 시간은 발아를 진행시키지 않습니다. */
inline double growingDegreeMinutes(double meanC, double baseC, double minutes) {
  const double excess = meanC - baseC;
  if (excess <= 0.0 || minutes <= 0.0) return 0.0;
  return excess * minutes;
}

// ── C 묶음 · 화학·환경 ────────────────────────────────────────────────────

/** C1: 건구에서 습구를 뺀 값. 증발은 온도를 낮추므로 이 값은 음수가 될 수 없습니다. */
inline double wetBulbDepression(double dryC, double wetC) { return dryC - wetC; }

/** C1: 습구가 건구보다 높으면 두 열이 뒤바뀐 것입니다. 값을 고치지 말고 알려야 합니다. */
inline bool isPsychrometerOrdered(double dryC, double wetC) { return wetC <= dryC; }

/** C2: 순수한 물의 어는점에서 용액의 어는점을 뺀 내림 폭. */
inline double freezingDepression(double pureC, double solutionC) { return pureC - solutionC; }

/** C2: 갈라지는 입자 수까지 넣은 예측값. 소금은 i=2입니다. */
inline double expectedDepression(double kf, double molality, double ions) {
  return kf * molality * ions;
}

/** C3: 맑은 물을 100 %로 삼은 투과율. 기준값이 0이면 비율을 말할 수 없습니다. */
inline double transmittancePercent(double raw, double baseline) {
  if (baseline <= 0.0) return 0.0;
  return 100.0 * raw / baseline;
}

/** C4: 저절로 식는 몫을 빼고 반응이 만든 온도만 남깁니다. */
inline double backgroundCorrected(double measuredC, double driftPerMin, double minutes) {
  return measuredC - driftPerMin * minutes;
}

/** C5: 상자 자체의 반사를 뺀 뒤 흰 종이로 나눈 상대 반사율. */
inline double relativeReflectance(double sample, double background, double white) {
  const double net = white - background;
  if (net <= 0.0) return 0.0;
  return (sample - background) / net;
}

/** C6: 같은 열을 받은 두 물질의 온도 상승 기울기 비. 비열의 비와 뒤집힌 관계입니다. */
inline double slopeRatio(double slopeA, double slopeB) {
  if (slopeB == 0.0) return 0.0;
  return slopeA / slopeB;
}

/** C7: 투과율에서 구한 흡광도. 빛이 전혀 통과하지 않으면 흡광도를 정의할 수 없습니다. */
inline double absorbance(double raw, double baseline) {
  if (raw <= 0.0 || baseline <= 0.0) return 0.0;
  return -std::log10(raw / baseline);
}

/** C8: 부피를 유량으로 나눈 값이 공기가 한 번 갈리는 데 걸리는 시간입니다. */
inline double airChangeTimeConstantMin(double volumeL, double flowLpm) {
  if (flowLpm <= 0.0) return 0.0;
  return volumeL / flowLpm;
}

// ── D 묶음 · 공학·로봇 ────────────────────────────────────────────────────
//
// 이 묶음의 계산은 대부분 **판정**입니다. 판정을 스케치 안에 흩어 두면
// 학생이 문턱값을 바꿔 볼 때마다 보드에 올려야 하지만, 여기 모아 두면
// 저장한 CSV로 몇 번이든 다시 판정해 볼 수 있습니다.

/** D1: 1초 창에서 센 펄스 수를 분당 회전수로. 회전당 자석이 하나일 때입니다. */
inline int pulsesToRpm(int pulses, double windowSeconds) {
  if (windowSeconds <= 0.0) return 0;
  return static_cast<int>(pulses * 60.0 / windowSeconds);
}

/** D1: 목표와의 차이만큼 한 단계 되돌립니다. 핀이 받을 수 있는 범위를 넘지 않습니다. */
inline int correctedSpeed(int current, int rpmError, int stepSize) {
  const int next = current + (rpmError > 0 ? stepSize : -stepSize);
  if (next < 0) return 0;
  return next > 255 ? 255 : next;
}

/** D2: 중력이 세 축에 나뉜 비율에서 되돌린 좌우 기울기. 멈춰 있을 때만 뜻이 있습니다. */
inline double rollDegrees(double y, double z) { return std::atan2(y, z) * 180.0 / 3.14159265358979323846; }

/** D3: 좌우 밝기 차이를 속도 차이로. 비율이 크면 예민하게 꺾습니다. */
inline int steeringCorrection(int leftAdc, int rightAdc, double gain) {
  return static_cast<int>((leftAdc - rightAdc) * gain);
}

/**
 * D4: 값이 가까워지면 켜는 판정(거리처럼 작아질 때 켜는 것). 켜는 기준과 끄는
 * 기준을 벌려 두지 않으면 값이 그 언저리에서 흔들릴 때마다 장치가 떱니다.
 */
inline bool hysteresisOnBelow(bool current, double value, double onBelow, double offAbove) {
  if (!current && value < onBelow) return true;
  if (current && value > offAbove) return false;
  return current;
}

/** D5·D6: 값이 커지면 켜는 판정(밝기·온도처럼 올라갈 때 켜는 것). */
inline bool hysteresisOnAbove(bool current, double value, double onAbove, double offBelow) {
  if (!current && value > onAbove) return true;
  if (current && value < offBelow) return false;
  return current;
}

/** D4·D8: 초음파가 되돌아오지 않으면 -1입니다. 그 값을 거리로 쓰면 안 됩니다. */
inline bool isEchoValid(long centimeters) { return centimeters > 0; }

/** D7: 중력 1 g를 뺀 나머지가 실제 흔들림의 크기입니다. */
inline double dynamicMagnitude(double gTotal) {
  const double dynamic = gTotal - 1.0;
  return dynamic < 0.0 ? -dynamic : dynamic;
}

/** D7: 한 번 울리면 유지 시간 동안은 계속 울립니다. 한순간만 울리면 알아채지 못합니다. */
inline bool alarmHeld(unsigned long now, unsigned long alarmUntil) { return now < alarmUntil; }

/** D8: 높이를 층 간격으로 나눠 반올림한 층 번호. 읽지 못한 거리는 -1로 남깁니다. */
inline int floorIndex(long centimeters, double floorHeightCm) {
  if (centimeters <= 0 || floorHeightCm <= 0.0) return -1;
  return static_cast<int>((centimeters + floorHeightCm / 2.0) / floorHeightCm);
}

/** D8: 흔들림의 두 배가 층 간격을 넘으면 같은 자리에서도 층이 오르내립니다. */
inline bool floorJudgementIsSafe(double stdDevCm, double floorHeightCm) {
  return 2.0 * stdDevCm < floorHeightCm;
}

// ── E 묶음 · 물리 ─────────────────────────────────────────────────────────

/** E1: 이웃한 두 점에서 구한 속도(m/s). 거리는 cm, 시간은 ms로 들어옵니다. */
inline double velocityMps(long cm1, long cm2, unsigned long ms1, unsigned long ms2) {
  if (ms2 <= ms1 || cm1 < 0 || cm2 < 0) return 0.0;
  return (cm1 - cm2) / 100.0 / ((ms2 - ms1) / 1000.0);
}

/** E1: 무게와 공기 저항이 같아지는 속도. 저항 계수가 0이면 종단 속도가 없습니다. */
inline double terminalVelocity(double massKg, double dragK) {
  if (dragK <= 0.0 || massKg <= 0.0) return 0.0;
  return std::sqrt(massKg * 9.80665 / dragK);
}

/** E2: 이웃한 두 봉우리에서 구한 감쇠 상수. 진폭이 늘었다면 감쇠가 아닙니다. */
inline double dampingConstant(double amplitude1, double amplitude2, double seconds) {
  if (amplitude1 <= 0.0 || amplitude2 <= 0.0 || seconds <= 0.0) return 0.0;
  if (amplitude2 >= amplitude1) return 0.0;
  return std::log(amplitude1 / amplitude2) / seconds;
}

/** E2: 감쇠 상수에서 구한 반감기. 처음 진폭이 얼마든 같습니다. */
inline double amplitudeHalfLife(double dampingPerSecond) {
  if (dampingPerSecond <= 0.0) return 0.0;
  return std::log(2.0) / dampingPerSecond;
}

/** E3: 점질량 네 개를 반지름 r에 대칭으로 둔 회전판의 관성 모멘트. */
inline double momentOfInertia(double massKg, double radiusM, int count) {
  return massKg * radiusM * radiusM * count;
}

/** E3: 마찰 토크가 같다면 감속 기울기의 비는 관성 모멘트 비의 역수입니다. */
inline double expectedSlopeRatio(double inertiaInner, double inertiaOuter) {
  if (inertiaInner <= 0.0) return 0.0;
  return inertiaOuter / inertiaInner;
}

}  // namespace phase7
