// The host token is scoped to this launch; this adapter never sends audio to a remote service.
export async function requestDictation(action, body = {}) {
  const token = document.querySelector('meta[name="abe-speech-session"]')?.content;
  if (!token) throw new Error("Dictation requires the local desktop host.");
  const response = await fetch(`/api/dictation/${action}`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-ABE-Speech-Session": token }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.message || "Dictation request failed.");
  return result;
}
