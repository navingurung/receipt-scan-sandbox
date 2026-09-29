const VERYFI_ENDPOINT = "https://api.veryfi.com/api/v8/partner/documents";
const TIMEOUT_MS = 30_000;

export class VeryfiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "VeryfiError";
  }
}

function getCredentials() {
  const clientId = process.env.VERYFI_CLIENT_ID;
  const username = process.env.VERYFI_USERNAME;
  const apiKey = process.env.VERYFI_API_KEY;

  if (!clientId || !username || !apiKey) {
    throw new VeryfiError("Veryfi credentials are not configured", 500);
  }
  return { clientId, username, apiKey };
}

function extractErrorMessage(data: unknown): string | undefined {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  return undefined;
}

export async function processReceipt(file: File): Promise<unknown> {
  const { clientId, username, apiKey } = getCredentials();
  const fileData = Buffer.from(await file.arrayBuffer()).toString("base64");

  const response = await fetch(VERYFI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "CLIENT-ID": clientId,
      AUTHORIZATION: `apikey ${username}:${apiKey}`,
    },
    body: JSON.stringify({
      file_name: file.name || "receipt.jpg",
      file_data: fileData,
      // 処理後に Veryfi 側からドキュメントを削除
      auto_delete: true,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new VeryfiError(
      extractErrorMessage(data) ?? `Veryfi request failed (${response.status})`,
      response.status,
    );
  }
  return data;
}
