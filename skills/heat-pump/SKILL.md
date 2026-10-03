---
name: heat-pump
description: Decide between a hybrid heat pump, a full electric (all-electric) heat pump, or waiting. Use when the user mentions warmtepomp, hybride, all-electric, CV-ketel replacement, or going gasless (van het gas af).
---

# Heat pump advisor

## When to use
Questions about heat pumps, replacing the central heating boiler (CV-ketel), or getting off gas.

## Procedure
1. Check insulation first. Call `calculate_plan` and look at what insulation measures remain.
   - If the house is label D or worse and wall/roof are uninsulated → recommend insulating first. A heat pump in a leaky house runs at high flow temperature and disappoints.
2. Decide the type:
   | Situation | Advice |
   |---|---|
   | Label E–G, insulation not done | Insulate first, revisit in 1–2 years |
   | Label C–D, boiler < 10 years old | **Hybrid** heat pump next to the boiler |
   | Label A–B, low-temperature radiators or floor heating | **All-electric** is realistic |
   | Apartment without outdoor unit space / VvE rules | Check VvE first, consider ventilation heat pump |
3. Mention the 50 °C test: turn the boiler flow temperature down to 50 °C for a cold week. If the house stays warm, it is ready for low-temperature heating.
4. Call `check_subsidies` with the heat pump measure — ISDE applies to both hybrid and all-electric.
5. Use `search_knowledge` with "heat pump" or "warmtepomp" and cite sources.

## Numbers
Never estimate SCOP, kWh or savings yourself — they come from `calculate_plan`. You may explain that a heat pump moves gas use to electricity, so savings depend on both prices.
