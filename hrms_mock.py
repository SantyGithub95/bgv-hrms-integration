# ============================================================
# hrms_mock.py
# Pretends to be SAP SuccessFactors — a simplified version of
# the contractor onboarding API that the real HRMS would expose
# ============================================================

# FastAPI is the web framework we use to build the API (like Express but for Python)
# BaseModel is used to describe the exact shape of the JSON we expect to receive
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime
import uvicorn   # uvicorn is the engine that actually runs the FastAPI server

# ----------------------------------------------------------
# SECTION 1: Create the FastAPI app and the in-memory store
# Think of 'contractors_db' as a temporary filing cabinet —
# it lives only while the server is running
# ----------------------------------------------------------
app = FastAPI(title="HRMS Mock — SAP SuccessFactors Simulator")

# This dictionary holds all contractor records while the server is running.
# Key   = contractor_id (e.g. "CTR-2024-00891")
# Value = the full record dict for that contractor
contractors_db = {}


# ----------------------------------------------------------
# SECTION 2: Define the shape of the incoming JSON payload
# Pydantic will automatically reject requests that are missing
# any of these fields, and tell the caller what's wrong
# ----------------------------------------------------------
class OnboardingStatusUpdate(BaseModel):
    status: str                    # e.g. "ACTIVATED", "PENDING", "REJECTED"
    verified_by: str               # name or ID of the system/person that verified
    verification_timestamp: str    # ISO datetime string from the BGV event
    event_reference_id: str        # event_id from the BGV payload — links the two systems


# ----------------------------------------------------------
# SECTION 3: POST endpoint — update (or create) a contractor
# URL pattern: POST /contractors/CTR-2024-00891/onboarding-status
# The contractor_id in the URL tells us WHICH record to update
# ----------------------------------------------------------
@app.post("/contractors/{contractor_id}/onboarding-status")
def update_onboarding_status(contractor_id: str, body: OnboardingStatusUpdate):

    # Log that a request came in so we can see activity in the terminal
    print(f"\n[HRMS] Received onboarding status update for contractor: {contractor_id}")
    print(f"       Status          : {body.status}")
    print(f"       Verified By     : {body.verified_by}")
    print(f"       Verified At     : {body.verification_timestamp}")
    print(f"       BGV Event Ref   : {body.event_reference_id}")

    # Check if this contractor already exists in our in-memory store.
    # If not, create a blank record for them first.
    if contractor_id not in contractors_db:
        print(f"[HRMS] Contractor {contractor_id} not found — creating new record.")
        contractors_db[contractor_id] = {
            "contractor_id": contractor_id,
            "created_at": datetime.utcnow().isoformat() + "Z"
        }

    # Update the contractor record with the new onboarding details
    contractors_db[contractor_id].update({
        "onboarding_status":      body.status,
        "verified_by":            body.verified_by,
        "verification_timestamp": body.verification_timestamp,
        "event_reference_id":     body.event_reference_id,
        "last_updated_at":        datetime.utcnow().isoformat() + "Z"
    })

    print(f"[HRMS] Record updated successfully for {contractor_id}.")

    # Return the full updated record back to the caller
    return {
        "message": "Contractor onboarding record updated successfully",
        "record":  contractors_db[contractor_id]
    }


# ----------------------------------------------------------
# SECTION 4: GET endpoint — fetch all contractor records
# Useful to verify what has been stored during a test run
# URL: GET /contractors
# ----------------------------------------------------------
@app.get("/contractors")
def get_all_contractors():

    print(f"\n[HRMS] GET /contractors — returning {len(contractors_db)} record(s).")

    # If nothing has been stored yet, return a helpful empty response
    if not contractors_db:
        return {"message": "No contractor records found.", "records": {}}

    return {
        "total_records": len(contractors_db),
        "records": contractors_db
    }


# ----------------------------------------------------------
# SECTION 5: Start the server when you run this file directly
# uvicorn runs the app on port 8000
# ----------------------------------------------------------
if __name__ == "__main__":
    print("Starting HRMS Mock Server on http://localhost:8000")
    print("Press Ctrl+C to stop.\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
