# Background Verification - Human Resources Management system Integration (bgv-hrms-integration)

A working prototype that closes the handoff gap between BGV (Background Verification) completion and HRMS contractor onboarding.

Built as a learning exercise to understand enterprise integration patterns — specifically the Time-to-Access problem in regulated hiring workflows.

## The Problem

In regulated industries like manufacturing, pharma, and construction, a contractor cannot gain physical site access until their background verification is reflected in the client's HRMS (for example, SAP SuccessFactors). Today, this handoff is often manual:

1. Contractor completes BGV in the verification vendor's portal
2. Verification result sits in the vendor's console
3. An HR manager logs into the HRMS separately and updates the contractor's onboarding status
4. Access control systems read the updated HRMS status and enable site access

The gap between step 2 and step 4 is Time-to-Access. In shift-based manufacturing, a delay here means a delayed shift. In regulated industries, it also creates compliance risk if a contractor's status is updated incorrectly or inconsistently.

## The Solution

Three independent services that together simulate an automated end-to-end flow:

- **BGV Simulator** (`simulator.js`) — Node.js script that fires a realistic BGV completion event to the middleware's webhook endpoint.
- **Integration Middleware** (`server.js`) — Node.js + Express server that receives the BGV event, evaluates the verification result using defensive validation logic, and calls the HRMS only when both the summary status and every individual check confirm the contractor is cleared.
- **HRMS Mock** (`hrms_mock.py`) — Python + FastAPI server that simulates a simplified SAP SuccessFactors contractor onboarding API. Stores contractor records in memory and returns standard REST responses.

## Architecture

```
simulator.js  →  POST /webhook  →  server.js  →  POST /contractors/:id  →  hrms_mock.py
 (port N/A)                       (port 3000)                            (port 8000)
```

## Failure Paths

When there is a clean rejection (all checks fail, overall_status = REJECTED), the HRMS doesn't get updated. The test was conducted with the contractor name: Ramesh Kumar Sharma

When there is an inconsistent payload — when overall_status says VERIFIED but one or more individual checks have FAILED. 
For example, one payload contained details of the Criminal Record check and PAN and Tax Compliance fields have a FAIL value, but the overall status was verified.
This was discovered while testing, not while designing, and the middleware correctly refuses to act when the summary and details disagree.

Trust-the-summary is fast but wrong when upstream data is inconsistent. In a regulated industry, requiring both the summary AND every individual check to confirm clearance prevents upstream bugs from causing downstream compliance failures. This is why defensive validation matters. 

## How to Run

You need three terminal windows.

Terminal 1 — HRMS mock:
```
pip install fastapi uvicorn
uvicorn hrms_mock:app --reload --port 8000
```

Terminal 2 — Integration middleware:
```
npm install
node server.js
```

Terminal 3 — Fire a BGV event:
```
node simulator.js
```

Then verify the record was created:
```
curl http://localhost:8000/contractors
```

## Technical Decisions

[Write three short explanations in your own words]

- The `express.json()` is used in server.js to tell the server to parse the incoming payloads as JSONs
- The verification checks are stored as an array of objects rather than individual keys so that multiple fields can be updated for different employees at once.
- Why the middleware requires both `overall_status === 'VERIFIED'` AND every check to pass before calling the HRMS (instead of trusting just one)

## What This Prototype Doesn't Do Yet

- Records exist only in memory — restart the HRMS process and all data is lost
- No authentication or webhook signature verification on incoming events
- No retry logic if the HRMS is unreachable when the middleware attempts to call it
- No real SAP API calls — the HRMS is a mock structured to look similar to SuccessFactors
- No separate audit log — the event trail lives only in the HRMS record itself
- Tested with synthetic data only, not with real or other vendor webhooks
- No handling of duplicate events if the same BGV completion fires twice

## What I Learned
HR raises a contractor requirement
Inside SAP HCM or SuccessFactors. A position is created. A contractor record is initiated. This lives entirely inside the client's enterprise system.
↓
Contractor is invited to BGV Gateway
HR sends a WhatsApp / SMS / email link. Contractor opens their hosted page on their phone and begins the verification journey — Aadhaar, PAN, PF UAN, education, prior employment.
↓
Contractor completes document upload
BGV Gateway validates documents in real time using OCR and government APIs.
↓
Verification result appears in BGV Console
HR manager logs into dashboard. Sees: 7/7 checks passed. Verification complete. The result exists — but only inside BGV system.
TIME-TO-ACCESS CLOCK STARTS HERE
↓   manual step
HR manually updates SAP / HRMS
Someone logs into SAP separately. Finds the contractor record. Changes onboarding status to "BGV Cleared." This could take minutes or days depending on workload, shift patterns, and whether the right person is available.
THE GAP — this step should not exist
↓   manual step
Access control system is updated
Gate / site access system (often integrated with SAP) reads the updated status and enables the contractor's badge or biometric entry. Can't happen until Step 5 is done.
↓
Contractor gains physical site access
The job is done. But the Time-to-Access — from Step 4 to Step 7 — could be hours or days. In a manufacturing plant running shifts, a delayed contractor means a delayed shift.
TIME-TO-ACCESS CLOCK ENDS HERE

Steps 4 to 6 is the gap I am building a solution for. The fix is: When BGV verification completes, it automatically fires a webhook that updates the SAP contractor record — no human in the loop. Time-to-Access collapses from hours or days to seconds.

[One honest paragraph in your own voice. Write this last. Things to consider:
- What surprised you about how simple the happy path was vs how much complexity lives in failure handling
- Discovering defensive validation accidentally while testing the failure path
- How much of enterprise integration is about system boundaries and assumptions between systems, not about code complexity
- Anything that was harder than you expected]

This paragraph is the one a reader will remember.
