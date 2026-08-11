function constantTimeMatch(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export function isAuthorizedCronRequest(req: Request): boolean {
  const expected = Deno.env.get("CRON_SECRET") ?? "";
  const actual = req.headers.get("x-cron-secret") ?? "";
  return expected.length >= 32 && constantTimeMatch(actual, expected);
}
