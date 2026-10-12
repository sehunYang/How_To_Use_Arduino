# INA219 on an RC branch (Wokwi chip)

Wokwi has no capacitor model. For a recipe that charges a capacitor through a
resistor and an INA219 (ph21), the generator (`withRcChips` in
`src/wokwi/phase5ProjectGenerator.ts`) swaps the INA219 for this chip. The chip
charges the capacitor itself:

- It drives VIN- (the capacitor's + node, which the recipe also wires to an
  analog pin) with `V_C = V_S - (V_S - V_0)·e^(-t/τ)`.
- It feeds the INA219 register model (`chips/ina219.c`) the same instant's
  current `(V_S - V_C) / (R + 0.1 Ω)` and the bus voltage `V_C`.
- `τ = (R + 0.1 Ω)·C`, counting the INA219's shunt.

The generator proves the branch is supply → resistor → VIN+ … VIN- → capacitor
→ GND before setting the attributes:

| Attribute | Source |
|---|---|
| `seriesOhms` | The resistor into VIN+. |
| `capacitanceUf` | The µF value in the wiring steps that name the capacitor, i.e. what the student is told to use. |
| `sourceVolts` | 5, the recipe's supply. |

The `connected` control (0 → 1) is the moment the student connects the supply.
Setting it back to 0 leaves the charge in place.

Not modelled: capacitor leakage and ESR, the ±20% tolerance of electrolytics,
and the discharge circuit (the recipe moves jumpers for it).
