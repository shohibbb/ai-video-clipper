import "dotenv/config";

type SmokeResult = {
  name: string;
  ok: boolean;
  message: string;
  status?: number;
  latencyMs?: number;
};

type SmokeContext = {
  baseUrl: string;
  cookieHeader?: string;
};

const DEFAULT_TIMEOUT_MS = 10_000;

function getTimeoutMs() {
  const value = Number(process.env.SMOKE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

function getBaseUrl() {
  const rawBaseUrl = process.env.STAGING_BASE_URL ?? process.env.SMOKE_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (!rawBaseUrl?.trim()) {
    throw new Error("Set STAGING_BASE_URL, SMOKE_BASE_URL, or NEXT_PUBLIC_APP_URL before running staging smoke tests.");
  }

  const url = new URL(rawBaseUrl);
  url.pathname = "";
  url.search = "";
  url.hash = "";

  const allowLocal = process.env.SMOKE_ALLOW_LOCAL === "true";

  if (!allowLocal && ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname)) {
    throw new Error("Smoke tests target localhost. Set SMOKE_ALLOW_LOCAL=true only for local smoke runs.");
  }

  return url.toString().replace(/\/$/, "");
}

function buildUrl(baseUrl: string, path: string) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function splitSetCookieHeader(value: string) {
  return value.split(/,(?=\s*[^;,=\s]+=)/);
}

function getSetCookieHeaders(headers: Headers) {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = withGetSetCookie.getSetCookie?.();

  if (setCookies?.length) {
    return setCookies;
  }

  const singleHeader = headers.get("set-cookie");

  return singleHeader ? splitSetCookieHeader(singleHeader) : [];
}

function toCookieHeader(setCookieHeaders: string[]) {
  return setCookieHeaders
    .map((value) => value.split(";")[0]?.trim())
    .filter((value): value is string => Boolean(value))
    .join("; ");
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, cookieHeader?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());
  const startedAt = Date.now();
  const headers = new Headers(init.headers);

  if (cookieHeader && !headers.has("cookie")) {
    headers.set("cookie", cookieHeader);
  }

  try {
    const response = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });

    return {
      response,
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function getVercelBypassCookie(baseUrl: string) {
  const bypassToken = process.env.VERCEL_PROTECTION_BYPASS;

  if (!bypassToken?.trim()) {
    return undefined;
  }

  const url = new URL(baseUrl);
  url.pathname = "/";
  url.searchParams.set("x-vercel-set-bypass-cookie", "true");
  url.searchParams.set("x-vercel-protection-bypass", bypassToken.trim());

  const { response } = await fetchWithTimeout(url.toString(), {
    redirect: "manual",
  });
  const cookieHeader = toCookieHeader(getSetCookieHeaders(response.headers));

  if (!cookieHeader) {
    throw new Error("Vercel bypass token did not return a bypass cookie. Check the token and project protection settings.");
  }

  return cookieHeader;
}

function printResult(result: SmokeResult) {
  const label = result.ok ? "OK" : "FAIL";
  const status = result.status ? ` status=${result.status}` : "";
  const latency = typeof result.latencyMs === "number" ? ` latency=${result.latencyMs}ms` : "";

  console.log(`${label} ${result.name}:${status}${latency} ${result.message}`);
}

async function checkStatus(context: SmokeContext, path: string, expectedStatus: number): Promise<SmokeResult> {
  const { response, latencyMs } = await fetchWithTimeout(buildUrl(context.baseUrl, path), {
    redirect: "manual",
  }, context.cookieHeader);
  const ok = response.status === expectedStatus;

  return {
    name: path,
    ok,
    status: response.status,
    latencyMs,
    message: ok ? `Returned expected ${expectedStatus}.` : `Expected ${expectedStatus}, got ${response.status}.`,
  };
}

async function checkHealth(context: SmokeContext): Promise<SmokeResult> {
  const { response, latencyMs } = await fetchWithTimeout(
    buildUrl(context.baseUrl, "/api/health"),
    {},
    context.cookieHeader,
  );
  const status = response.status;

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    return {
      name: "/api/health",
      ok: false,
      status,
      latencyMs,
      message: body || "Health endpoint did not return 2xx.",
    };
  }

  const body = (await response.json()) as {
    ok?: boolean;
    dependencies?: {
      database?: { ok?: boolean };
      redis?: { ok?: boolean };
    };
  };
  const ok = body.ok === true && body.dependencies?.database?.ok === true && body.dependencies?.redis?.ok === true;

  return {
    name: "/api/health",
    ok,
    status,
    latencyMs,
    message: ok ? "Database and Redis are reachable." : "Health JSON did not report ok database and Redis checks.",
  };
}

async function checkDashboardAuth(context: SmokeContext): Promise<SmokeResult> {
  const expectAuthenticated = process.env.SMOKE_EXPECT_AUTHENTICATED === "true";
  const { response, latencyMs } = await fetchWithTimeout(buildUrl(context.baseUrl, "/dashboard"), {
    redirect: "manual",
  }, context.cookieHeader);

  if (expectAuthenticated) {
    const ok = response.status === 200;

    return {
      name: "/dashboard auth",
      ok,
      status: response.status,
      latencyMs,
      message: ok ? "Dashboard returned 200 for authenticated smoke target." : "Expected dashboard 200.",
    };
  }

  const location = response.headers.get("location") ?? "";
  const ok = [302, 303, 307, 308].includes(response.status) && location.includes("/api/auth/signin");

  return {
    name: "/dashboard auth",
    ok,
    status: response.status,
    latencyMs,
    message: ok
      ? "Unauthenticated dashboard access redirects to sign-in."
      : `Expected sign-in redirect, got location "${location || "(none)"}".`,
  };
}

async function runSmokeTests() {
  const baseUrl = getBaseUrl();
  const context: SmokeContext = {
    baseUrl,
    cookieHeader: await getVercelBypassCookie(baseUrl),
  };
  const checks = await Promise.allSettled([
    checkHealth(context),
    checkStatus(context, "/", 200),
    checkStatus(context, "/terms", 200),
    checkStatus(context, "/privacy", 200),
    checkDashboardAuth(context),
  ]);
  const results = checks.map((check, index): SmokeResult => {
    if (check.status === "fulfilled") {
      return check.value;
    }

    const fallbackNames = ["/api/health", "/", "/terms", "/privacy", "/dashboard auth"];

    return {
      name: fallbackNames[index] ?? "unknown",
      ok: false,
      message: check.reason instanceof Error ? check.reason.message : "Smoke check failed.",
    };
  });

  for (const result of results) {
    printResult(result);
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`Smoke summary: ${results.length - failed.length} ok, ${failed.length} failed.`);

  process.exitCode = failed.length > 0 ? 1 : 0;
}

void runSmokeTests().catch((error) => {
  console.error(error instanceof Error ? error.message : "Smoke tests failed.");
  process.exitCode = 1;
});
