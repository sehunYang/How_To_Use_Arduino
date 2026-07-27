# BME280 Wokwi 커뮤니티 칩 검토

## 판정

Phase 2에서는 커뮤니티 BME280 칩을 **채택하지 않습니다**.

검토 대상은
[`bonnyr/wokwi-bme280-custom-chip` v0.0.25](https://github.com/bonnyr/wokwi-bme280-custom-chip/releases/tag/v0.0.25)이며,
[MIT 라이선스](https://github.com/bonnyr/wokwi-bme280-custom-chip/blob/0d1c64e2d06ca12145e1d36f0480f1651693fcf9/LICENSE)라
재배포 자체는 가능합니다. 그러나 다음 이유로 이 프로젝트의 L3 정확성 검증에는 맞지 않습니다.

- [구현 문서](https://github.com/bonnyr/wokwi-bme280-custom-chip/blob/0d1c64e2d06ca12145e1d36f0480f1651693fcf9/chip/README.md)는
  4-wire SPI만 지원하고 I2C를 지원하지 않습니다.
- 측정값은 런타임 환경 모델이 아니라 하루 분량의 사전 기록 데이터를 재생합니다.
- 공개 배포물은 WASM이며 구현 소스를 감사하거나 수정할 수 없습니다.
- [유지보수자 설명](https://github.com/bonnyr/wokwi-bme280-custom-chip/issues/1#issuecomment-4531286981)도
  실제 부품 동작과 일치하지 않는다고 명시합니다.
- 실제 BME280의 모드·필터·타이밍·정확도 계약은
  [Bosch 데이터시트](https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bme280-ds002.pdf)와
  차이가 큽니다.

따라서 `bme280.wokwi.simSupported`는 `false`로 유지합니다. 향후 공식 Wokwi 부품이나
감사 가능한 I2C 커스텀 칩이 생기면 이 결정을 재검토합니다. 해당 커뮤니티 칩은
정확성 검증이 아닌 일회성 SPI 프로토콜 데모에만 조건부로 사용할 수 있습니다.
