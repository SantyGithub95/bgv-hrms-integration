// ============================================================
// simulator.js
// Pretends to be a BGV platform sending a "verification done"
// event to our integration server running on localhost:3000
// ============================================================

// axios lets Node.js make HTTP requests (like a browser form submit, but in code)
const axios = require('axios');

// crypto is built into Node.js — we use it only to generate a random unique ID
const { randomUUID } = require('crypto');

// ----------------------------------------------------------
// SECTION 1: Build the fake BGV event payload
// This is the JSON body the real BGV platform would send us
// ----------------------------------------------------------
const bgvPayload = {

  // What kind of event this is
  event_type: "BGV_VERIFICATION_COMPLETED",

  // A unique ID for this specific event (generated fresh each time you run the script)
  event_id: randomUUID(),

  // When the event happened (current date/time in standard ISO format)
  timestamp: new Date().toISOString(),

  // Details about the candidate whose background was verified
  candidate: {
    full_name: "Ramesh Kumar Sharma",
    aadhaar_masked: "XXXX-XXXX-4821",   // last 4 digits visible, rest hidden for privacy
    pan_number: "ABCRS1234F",
    pf_uan: "100123456789"
  },

  // Details about the company / HRMS system that requested the check
  client: {
    client_name: "Acme Infotech Pvt Ltd",
    hrms_system: "SAP SuccessFactors",
    contractor_record_id: "CTR-2024-00891"   // ID of the worker record in the HRMS
  },

  // The actual results of the background verification
  verification_result: {
    overall_status: "REJECTED",   // top-level verdict

    // Individual checks — each must pass before the candidate can be onboarded
    checks: [
      { check_name: "Identity Verification",           status: "PASS" },
      { check_name: "Address Verification",            status: "PASS" },
      { check_name: "Employment History (Last 5 Yrs)", status: "PASS" },
      { check_name: "Education Credential Check",      status: "PASS" },
      { check_name: "Criminal Record Check",           status: "FAIL" },
      { check_name: "PAN & Tax Compliance",            status: "FAIL" },
      { check_name: "PF UAN Linkage Check",            status: "PASS" }
    ]
  }
};

// ----------------------------------------------------------
// SECTION 2: Send the payload to our local webhook server
// We POST to http://localhost:3000/webhook — the same address
// our server (server.js) is listening on
// ----------------------------------------------------------
async function fireBgvEvent() {
  try {
    await axios.post('http://localhost:3000/webhook', bgvPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // If we reach this line, the server accepted the request without error
    console.log('BGV event fired successfully');
    console.log('Event ID sent:', bgvPayload.event_id);

  } catch (error) {
    // Something went wrong — server not running, network issue, etc.
    console.error('Failed to fire BGV event:', error.message);
  }
}

// ----------------------------------------------------------
// SECTION 3: Actually run the function we defined above
// ----------------------------------------------------------
fireBgvEvent();
