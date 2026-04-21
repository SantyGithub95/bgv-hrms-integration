// ============================================================
// server.js
// A simple webhook receiver that waits for BGV events and
// prints the details when one arrives
// ============================================================

// Express is a popular framework that makes building web servers easy in Node.js
const express = require('express');

// axios is used to make outbound HTTP calls — here we use it to call the HRMS mock
const axios = require('axios');

const app = express();

// This tells Express to automatically parse incoming JSON payloads
// Without this line, req.body would be empty even though data was sent
app.use(express.json());

// ----------------------------------------------------------
// SECTION 1: Define the webhook endpoint
// When the simulator POSTs to http://localhost:3000/webhook,
// this block of code runs
// ----------------------------------------------------------
// async lets us use 'await' inside — needed so we can pause and wait for the HRMS call to finish
app.post('/webhook', async (req, res) => {
  const payload = req.body;   // the full JSON sent by the simulator

  console.log('\n========================================');
  console.log('BGV EVENT RECEIVED');
  console.log('========================================');

  // Print the top-level event details
  console.log('Event Type  :', payload.event_type);
  console.log('Event ID    :', payload.event_id);
  console.log('Timestamp   :', payload.timestamp);

  // Print candidate details
  console.log('\n--- Candidate ---');
  console.log('Name        :', payload.candidate.full_name);
  console.log('Aadhaar     :', payload.candidate.aadhaar_masked);
  console.log('PAN         :', payload.candidate.pan_number);
  console.log('PF UAN      :', payload.candidate.pf_uan);

  // Print client / HRMS details
  console.log('\n--- Client ---');
  console.log('Company     :', payload.client.client_name);
  console.log('HRMS System :', payload.client.hrms_system);
  console.log('Record ID   :', payload.client.contractor_record_id);

  // Print each individual verification check
  console.log('\n--- Verification Checks ---');
  payload.verification_result.checks.forEach((check) => {
    console.log(`  ${check.status}  ${check.check_name}`);
  });

  // Print the final verdict
  console.log('\nOverall Status:', payload.verification_result.overall_status);
  console.log('========================================\n');

  // ----------------------------------------------------------
  // SECTION 2: Decision layer — should we update the HRMS?
  // Two conditions must BOTH be true before we proceed:
  //   (a) overall_status is exactly 'VERIFIED'
  //   (b) every individual check has status 'PASS'
  // ----------------------------------------------------------

  // Condition (a): check the top-level verdict
  const overallVerified =
    payload.verification_result.overall_status === 'VERIFIED';

  // Condition (b): every() returns true only if ALL checks pass
  const allChecksPassed =
    payload.verification_result.checks.every((check) => check.status === 'PASS');

  if (overallVerified && allChecksPassed) {

    console.log('[Decision] All checks PASSED — proceeding to update HRMS.');

    // Build the contractor-specific URL using the record ID from the payload
    const contractorId = payload.client.contractor_record_id;
    const hrmsUrl = `http://localhost:8000/contractors/${contractorId}/onboarding-status`;

    // Build the body we will send to the HRMS mock
    const hrmsBody = {
      status:                   'BGV_CLEARED',
      verified_by:              'Equal BGV Gateway',
      verification_timestamp:   payload.timestamp,
      event_reference_id:       payload.event_id
    };

    try {
      // Make the POST call to the HRMS mock and wait for the response
      const hrmsResponse = await axios.post(hrmsUrl, hrmsBody);

      console.log('[HRMS] Update successful. Response from HRMS:');
      console.log(JSON.stringify(hrmsResponse.data, null, 2));

    } catch (hrmsError) {
      // HRMS call failed (e.g. hrms_mock.py isn't running) —
      // we still return 200 to the simulator so it isn't retried endlessly
      console.error('[HRMS] Call failed — HRMS was NOT updated.');
      console.error('[HRMS] Error:', hrmsError.message);
    }

  } else {
    // At least one check failed or overall status is not VERIFIED
    console.log('[Decision] Verification incomplete — HRMS not updated.');
    console.log(`           overall_status="${payload.verification_result.overall_status}", allChecksPassed=${allChecksPassed}`);
  }

  // ----------------------------------------------------------
  // SECTION 3: Send a confirmation back to the simulator
  // We always return 200 so the BGV platform knows we received
  // the event — even if the HRMS update failed
  // ----------------------------------------------------------
  res.status(200).json({
    status: 'received',
    message: 'BGV event processed successfully',
    event_id: payload.event_id
  });
});

// ----------------------------------------------------------
// SECTION 4: Start the server and keep it running
// It will sit and wait until a request comes in
// ----------------------------------------------------------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Webhook server is running on http://localhost:${PORT}`);
  console.log('Waiting for BGV events...\n');
});
