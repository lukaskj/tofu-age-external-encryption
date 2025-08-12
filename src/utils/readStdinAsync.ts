export async function readStdinAsync() {
  let data = "";
  for await (const chunk of process.stdin) {
    data += chunk;
  }

  return data;
}
