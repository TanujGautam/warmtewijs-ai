---
name: subsidies
description: Check which subsidy schemes apply (ISDE for owner-occupiers, SVVE for VvE's, municipal schemes) and explain the conditions and application order. Use when the user asks about subsidie, ISDE, SVVE, RVO, or "what do I get back".
---

# Subsidy checker

## When to use
Any question about subsidies, grants, or "what do I get back".

## Procedure
1. Determine the applicant type: `owner` (eigenaar-bewoner), `vve`, or `renter` (huurder — usually not eligible; switch to the **renters** skill).
2. Call `check_subsidies` with the measures and applicant type. The tool returns amounts and conditions — never invent amounts.
3. Explain the rules that cost people money when they miss them:
   - **ISDE: apply within 24 months after installation**, with the invoice and proof of payment.
   - **Two-measure bonus**: insulation measures get a higher rate when you do two or more within 24 months (or one insulation measure + a heat pump).
   - Minimum surface areas apply (e.g. ≥ 10 m² for roof, ≥ 10 m² for wall, ≥ 3 m² glass).
   - The installer must be a registered company; DIY work is generally not eligible for insulation ISDE.
4. Point to the official source: rvo.nl. If web search is available, you may verify the current year's rates on rvo.nl and say which year the numbers apply to.

## Tone
Subsidy rules change every year. Always end with: "Rates are indicative for 2026 — check RVO before you sign."
