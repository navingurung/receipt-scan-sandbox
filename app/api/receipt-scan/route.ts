import { NextResponse } from "next/server";
import { processReceipt, VeryfiError } from "@/lib/veryfi";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  try {
    const result = await processReceipt(file);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof VeryfiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return NextResponse.json({ error: "Veryfi request timed out" }, { status: 504 });
    }
    console.error("receipt-scan failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
