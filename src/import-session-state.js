export function isCurrentImportRequest(session, currentBankState, currentRequestId) {
  return Boolean(
    session
    && session.stateAtStart === currentBankState
    && session.requestId === currentRequestId
  );
}
