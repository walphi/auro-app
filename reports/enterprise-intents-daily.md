# Nightly Offplan Intent Analysis Report
**Date:** 2026-01-15
**Timeframe:** Last 24 Hours

## Summary: Offplan Leads by Source
| Source | New Leads | Qualified Leads | Booking Intents | Confirmed Bookings |
| :--- | :---: | :---: | :---: | :---: |
| WhatsApp | 0 | 1 | 1 | 1 |
| Meta Ads | 0 | 0 | 0 | 0 |
| Google Ads | 0 | 0 | 0 | 0 |
| Property Finder | 0 | 0 | 0 | 0 |

*Note: Data for today reflects active nurturing of existing leads. No new leads from Meta/Google ads were captured in the last 24h.*

## Intent Breakdown by Project
| Project / Listing | Intent Type | Count | Status |
| :--- | :--- | :---: | :--- |
| **Vida Residences** (Creek Beach) | `booking_interest` | 1 | Advanced Nurturing |
| **Vida Residences** (Creek Beach) | `booking_confirmed` | 1 | **VAPI Resolved** |
| General Inquiry | `test_verification` | 2 | System Check |

## Funnel Snapshot (Offplan)
- **Qualification Rate**: 100% (based on active sessions)
- **Booking Intent Rate**: 100%
- **VAPI Conversion Rate**: 100% (`booking_interest` → `booking_confirmed`)

## Anonymized Examples
1. **Example (Vida Residences):**
   - **Lead Context:** User inquired about high-floor corner units in Creek Beach.
   - **Interaction:** WhatsApp agent provided visual cards and property details.
   - **Outcome:** Lead expressed interest in a viewing. Escalated to VAPI voice agent. VAPI successfully resolved a booking for Dec 23rd at 1:00 PM (Dubai Time).

## Suggested Question / Prompt Changes

### 1. WhatsApp: Offplan Scarcity Framing
*   **Target Stage:** WhatsApp Nurturing (Discovery Phase)
*   **Relevance:** Meta Ads / Google Ads leads
*   **Hypothesis:** Offplan leads often browse multiple projects. Creating a sense of exclusivity/urgency around specific units increases the conversion to a booking call.
*   **Suggested Change:** When the `SEARCH_LISTINGS` tool returns a project with high interest (e.g., Creek Beach/District 11), the agent should include: *"This specific layout is currently seeing high interest from overseas investors. Would you like me to reserve a session with the specialist for a digital walkthrough before the next release?"*

### 2. VAPI: Sales Centre Value Prop
*   **Target Stage:** VAPI Voice Closing
*   **Relevance:** Local Leads (+971) / Property Finder Enquiries
*   **Hypothesis:** Some leads are hesitant to commit to a physical visit. Highlighting the physical "show-home" experience increases booking confirmations.
*   **Suggested Change:** In `vapi-llm.ts`, when offering the Sales Centre visit, refine the script to: *"I recommend a visit to the Sales Centre. We have the physical model of the project and the actual flooring and finish materials on display. It's the best way to feel the space before confirming your choice. Shall we set that up for tomorrow?"*

### 3. Progressive Qualification for Ads
*   **Target Stage:** WhatsApp Initial Engagement
*   **Relevance:** Meta Ads / Property Finder
*   **Hypothesis:** Leads from ads often bounce if asked for too much data early. Focus on "Investment Goal" first to build rapport.
*   **Suggested Change:** For new leads where `source` contains 'Ads', prioritize asking: *"Hi! Thanks for your interest in [Project]. Are you looking at this as a high-yield investment opportunity or for your own residence in Dubai?"* before asking for email/budget.
