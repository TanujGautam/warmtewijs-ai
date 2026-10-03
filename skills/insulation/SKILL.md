---
name: insulation
description: Advise on insulating walls, roof, floor and glazing for a Dutch home — which order, what it costs, and when NOT to do it. Use when the user asks about isolatie, spouwmuur, dak, vloer, HR++ or triple glass, damp, or "what should I insulate first".
---

# Insulation advisor

## When to use
The user asks what to insulate, in what order, or whether a specific insulation measure is worth it.

## Procedure
1. Make sure you know the house: call `lookup_house` if you have a postcode + house number and haven't yet.
2. Ask (or read from memory) which measures are already done. Never recommend a measure the user already has.
3. Call `calculate_plan` — never compute savings or payback yourself. The tool is the source of truth for every number.
4. Explain the ranking in this order of reasoning:
   - **Trias energetica**: reduce demand first (insulate), then make heat efficient (heat pump), then generate (solar).
   - Cheapest €/m³ saved goes first. Cavity wall (spouwmuur) is usually the best payback in homes built 1930–1975.
   - Roof before floor in detached and corner houses; floor matters more in houses with a crawl space (kruipruimte).
5. Always mention the two risks that installers skip:
   - **Ventilation**: an airtighter house needs ventilation (roosters, mechanical extraction) or you get damp and mould.
   - **Cavity check**: a spouwmuur needs a cavity of ≥ 5 cm and no damp problems — an installer should do a boroscope check.
6. Search the knowledge base (`search_knowledge`) for the specific measure and cite the source id in brackets, e.g. [insulation-basics].

## Don'ts
- Don't recommend triple glass over HR++ on payback grounds unless the frames are being replaced anyway.
- Don't recommend interior wall insulation (binnenmuurisolatie) without warning about condensation risk.
- Don't present indicative numbers as quotes. Say "indicative — get two quotes".
