import assert from "node:assert/strict";
import test from "node:test";
import { formatStorageUploadError } from "../src/lib/storage/upload-errors";

test("explains Supabase storage size limit errors", () => {
  const message = formatStorageUploadError(
    413,
    JSON.stringify({
      statusCode: "413",
      error: "Payload too large",
      message: "The object exceeded the maximum allowed size",
    }),
  );

  assert.match(message, /Supabase Storage rejected this video/);
  assert.match(message, /global file size limit/);
});

test("keeps non-size storage error details", () => {
  assert.equal(formatStorageUploadError(400, JSON.stringify({ message: "Invalid signature" })), "Invalid signature");
});
