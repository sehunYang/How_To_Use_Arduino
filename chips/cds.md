# CdS divider Wokwi chip

Wokwi has no part for a bare photoresistor, so generated simulation projects
swap each recipe's CdS illustration for this chip. It drives the divider's
analog node with the voltage a GL5528-class cell would produce:
`5 V × fixed / (fixed + R_cds)`, where `R_cds = 15 kΩ × (lux / 10)^-0.7`, capped
at 1 MΩ in the dark.

The generator (`withCdsChips` in `src/wokwi/phase5ProjectGenerator.ts`) checks
that the recipe wires the divider as the chip models it before setting the
attributes:

| Attribute | Meaning |
|---|---|
| `nodePin` | `1` or `2`: the leg on the analog pin. The other leg sits on 5 V. |
| `fixedOhms` | The resistor from the analog pin to GND. |
| `supplyVolts` | 5. |

The `lux` control is the light falling on the cell. The value refreshes every
1 ms of simulated time.

Limitations:

- The cell's response time (tens of ms) and part-to-part spread (10-20 kΩ at
  10 lux) are not modelled. Behaviour specs judge the sketch, not the cell.
- Only the CdS-on-the-supply-side divider exists, because every recipe uses it.
  The generator rejects any other wiring instead of simulating it wrongly.
