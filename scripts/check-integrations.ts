import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { requireReapApiKey } from "../src/lib/reap/config";
import { getIntegrations } from "../src/lib/reap/api";

type CheckResult = {
  name: string;
  ok: boolean;
  message: string;
};

function hasValue(value: string | undefined | null) {
  return Boolean(value?.trim());
}

function printResult(result: CheckResult) {
  console.log(`${result.ok ? "OK" : "TODO"} ${result.name}: ${result.message}`);
}

async function checkSupabase(): Promise<CheckResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "clips";

  if (!hasValue(supabaseUrl) || !hasValue(serviceRoleKey)) {
    return {
      name: "Supabase Storage",
      ok: false,
      message: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.",
    };
  }

  const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.storage.getBucket(bucket);

  if (error) {
    return {
      name: "Supabase Storage",
      ok: false,
      message: `Could not read bucket "${bucket}": ${error.message}`,
    };
  }

  return {
    name: "Supabase Storage",
    ok: true,
    message: `Bucket "${data.name}" is reachable and ${data.public ? "public" : "private"}.`,
  };
}

async function checkReapApiKey(): Promise<CheckResult> {
  const apiKey = process.env.REAP_API_KEY;

  if (!hasValue(apiKey)) {
    return {
      name: "Reap API Key",
      ok: false,
      message: "Set REAP_API_KEY in .env.",
    };
  }

  return {
    name: "Reap API Key",
    ok: true,
    message: "REAP_API_KEY is set.",
  };
}

async function checkReapIntegration(): Promise<CheckResult> {
  try {
    requireReapApiKey();
  } catch {
    return {
      name: "Reap Integration",
      ok: false,
      message: "REAP_API_KEY is not set. Cannot check integrations.",
    };
  }

  try {
    const response = await getIntegrations();
    const tiktokIntegration = response.integrations.find(
      (i) => i.platform === "tiktok" && i.isActive,
    );

    if (!tiktokIntegration) {
      return {
        name: "Reap TikTok Integration",
        ok: false,
        message: "No active TikTok integration found. Connect one at https://reap.video/settings/integrations.",
      };
    }

    return {
      name: "Reap TikTok Integration",
      ok: true,
      message: `Found active TikTok integration: @${tiktokIntegration.username} (${tiktokIntegration.name}).`,
    };
  } catch (error) {
    return {
      name: "Reap TikTok Integration",
      ok: false,
      message: `Failed to check Reap integrations: ${error instanceof Error ? error.message : "Unknown error"}.`,
    };
  }
}

async function main() {
  const results = await Promise.allSettled([
    checkSupabase(),
    checkReapApiKey(),
    checkReapIntegration(),
  ]);

  let ok = true;

  for (const result of results) {
    if (result.status === "fulfilled") {
      printResult(result.value);
      ok &&= result.value.ok;
    } else {
      ok = false;
      printResult({
        name: "Integration Check",
        ok: false,
        message: result.reason instanceof Error ? result.reason.message : "Unknown setup check error.",
      });
    }
  }

  process.exitCode = ok ? 0 : 1;
}

void main();