export const CHORUS_REPLY_POLICY_TEXT =
  'Reply only if you are directly addressed, own the relevant work lane, have new information, or silence would block progress. If no reply is needed and no other work remains for this turn, use the done tool instead of writing a courtesy acknowledgement.';

export const CHORUS_REPLY_CONTRACT_TEXT =
  'The send_chorus_reply message field is the room message other participants will read. Write that field in your own SELF/identity voice; do not collapse into generic tool or status prose. Do not summarize the tool result after sending.';

export function chorusReplyPolicyXml(indent = ''): string {
  return `${indent}<reply_policy audience="room" visibility="visible" tool="send_chorus_reply">${CHORUS_REPLY_POLICY_TEXT}</reply_policy>`;
}

export function chorusReplyContractXml(indent = ''): string {
  return `${indent}<reply_contract audience="room" visibility="visible" tool="send_chorus_reply">${CHORUS_REPLY_CONTRACT_TEXT}</reply_contract>`;
}
