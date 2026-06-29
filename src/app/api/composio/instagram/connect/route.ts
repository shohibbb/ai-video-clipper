import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { requireCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await requireCurrentUser();
  const body = (await request.json().catch(() => ({}))) ?? {};
  const alias = body.alias as string | undefined;

  const scriptPath = process.cwd() + "/scripts/composio-connect.py";

  return new Promise<NextResponse>((resolve) => {
    // Unique entity per IG account so upload always uses the right connection
    const entityId = `${user.id}-ig-${Date.now()}`;

    const args = JSON.stringify({
      user_id: entityId,
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/composio/instagram/callback?userId=${user.id}`,
    });

    const child = spawn("python", [scriptPath, args], {
      env: {
        ...process.env,
        COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY ?? "",
      },
      timeout: 30_000,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error("composio-connect stderr:", stderr);
        return resolve(
          NextResponse.json(
            {
              error: `Python script exited with code ${code}: ${stderr || stdout}`,
            },
            { status: 502 },
          ),
        );
      }

      try {
        const result = JSON.parse(stdout);

        if (!result.success) {
          return resolve(
            NextResponse.json(
              { error: result.error || "Failed to initiate connection." },
              { status: 502 },
            ),
          );
        }

        return resolve(
          NextResponse.json({
            redirectUrl: result.redirectUrl,
            connectedAccountId: result.connectedAccountId,
            entityId,
          }),
        );
      } catch {
        return resolve(
          NextResponse.json(
            { error: "Invalid response from connection script." },
            { status: 502 },
          ),
        );
      }
    });

    child.on("error", (err) => {
      return resolve(
        NextResponse.json(
          { error: `Failed to spawn Python: ${err.message}` },
          { status: 500 },
        ),
      );
    });
  });
}
