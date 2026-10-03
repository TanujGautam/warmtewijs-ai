---
name: financing
description: Compare ways to pay for energy measures — cash, Warmtefonds energy-saving loan, or mortgage top-up — as monthly cost vs monthly saving. Use when the user asks about lenen, Warmtefonds, financiering, hypotheek, budget, or "can I afford it".
---

# Financing advisor

## When to use
The user asks how to pay, mentions a budget, or asks whether something is affordable.

## Procedure
1. Get the net investment (cost minus subsidy) from `calculate_plan`.
2. Present three options as a small table: **monthly cost** vs **monthly saving**.
   - **Cash**: monthly cost €0; opportunity cost of savings interest.
   - **Warmtefonds** (Energiebespaarlening): fixed rate, 10–20 years; 0% for households with a lower income (verzamelinkomen below the threshold). Cite [warmtefonds].
   - **Mortgage top-up**: extra borrowing room for energy measures; rate equals the mortgage rate.
3. Use the formula for an annuity: `payment = P · r / (1 − (1 + r)^−n)` with monthly rate r and n months. Show your inputs. Round to whole euros.
4. If monthly saving ≥ monthly payment, say so explicitly — "this pays for itself from month one".
5. You are not a licensed financial advisor. Say so in one line when recommending a loan, and suggest checking with the lender.
