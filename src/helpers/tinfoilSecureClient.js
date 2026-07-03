// Verified-WebSocket access to Tinfoil's realtime transcription endpoint.
// The tinfoil SDK's SecureClient attests the enclave against its transparency
// log and pins the WebSocket's TLS connection to the attested key. One
// SecureClient is held for the session: the SDK memoizes attestation, so only
// the first dictation pays the verification round-trip.
let clientPromise = null;

function getSecureClient() {
  if (!clientPromise) {
    // ESM-only package, loaded from CommonJS.
    clientPromise = import("tinfoil").then(({ SecureClient }) => new SecureClient());
    // Don't cache a failed import — the next dictation should retry.
    clientPromise.catch(() => {
      clientPromise = null;
    });
  }
  return clientPromise;
}

// createWebSocket attests on first use, pins the TLS connection to the
// attested key, and refuses to send the auth header to any other host.
async function createTinfoilRealtimeSocket({ model, apiKey }) {
  const client = await getSecureClient();
  const path = `/v1/realtime?model=${encodeURIComponent(model)}&intent=transcription`;
  return client.createWebSocket(path, {
    wsOptions: { headers: { Authorization: `Bearer ${apiKey}` } },
  });
}

module.exports = { createTinfoilRealtimeSocket };
