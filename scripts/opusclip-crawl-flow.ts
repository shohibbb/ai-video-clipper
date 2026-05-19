import "dotenv/config";
import { existsSync } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import { getOpusClipConfig } from "../src/lib/opusclip/config";
import { opusClipSelectors } from "../src/lib/opusclip/selectors";

type CrawlBrowser = {
  browser?: Browser | null;
  context: BrowserContext;
  page: Page;
};

type ControlSnapshot = {
  tag: string;
  text: string | null;
  ariaLabel: string | null;
  role: string | null;
  type: string | null;
  href: string | null;
  disabled: boolean;
  className: string | null;
  visibleTextHint: string | null;
  title: string | null;
  dataTestId: string | null;
  svgText: string | null;
  rect: { x: number; y: number; width: number; height: number } | null;
  outerHTML: string;
};

const supportedVideoExtensions = new Set([".mp4", ".mov", ".webm"]);

function isEnabled(name: string) {
  return process.env[name] === "true";
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function getCrawlTimeoutMs() {
  const value = Number(process.env.OPUSCLIP_CRAWL_TIMEOUT_MS ?? 45 * 60 * 1000);
  return Number.isFinite(value) && value > 0 ? value : 45 * 60 * 1000;
}

async function findSmallestSourceVideo(dir: string): Promise<string | null> {
  const entries = await readdir(dir, {
    recursive: true,
    withFileTypes: true,
  }).catch(() => []);
  const candidates: Array<{ path: string; size: number }> = [];

  for (const entry of entries) {
    if (!entry.isFile() || !supportedVideoExtensions.has(extname(entry.name).toLowerCase())) {
      continue;
    }

    const filePath = resolve(dir, entry.parentPath, entry.name);
    const fileStat = await stat(filePath).catch(() => null);

    if (fileStat) {
      candidates.push({
        path: filePath,
        size: fileStat.size,
      });
    }
  }

  candidates.sort((a, b) => a.size - b.size);
  return candidates[0]?.path ?? null;
}

async function resolveSourceFile() {
  const explicitPath = process.env.OPUSCLIP_CRAWL_SOURCE_FILE?.trim();

  if (explicitPath) {
    const filePath = resolve(explicitPath);

    if (!existsSync(filePath)) {
      throw new Error(`OPUSCLIP_CRAWL_SOURCE_FILE does not exist: ${filePath}`);
    }

    return filePath;
  }

  const fallback = await findSmallestSourceVideo(resolve("./downloads/opusclip/sources"));

  if (!fallback) {
    throw new Error("No source video found. Set OPUSCLIP_CRAWL_SOURCE_FILE to a local MP4, MOV, or WEBM file.");
  }

  return fallback;
}

async function openBrowser(): Promise<CrawlBrowser> {
  const config = getOpusClipConfig();
  const usePersistentContext = config.usePersistentContext && isEnabled("OPUSCLIP_CRAWL_USE_PERSISTENT_CONTEXT");

  if (usePersistentContext) {
    const context = await chromium.launchPersistentContext(config.userDataDir, {
      acceptDownloads: true,
      headless: false,
    });

    return {
      browser: context.browser(),
      context,
      page: context.pages()[0] ?? (await context.newPage()),
    };
  }

  const browser = await chromium.launch({
    headless: false,
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    storageState: config.storageStatePath,
  });

  return {
    browser,
    context,
    page: await context.newPage(),
  };
}

async function isLoginPage(page: Page) {
  const hasLoginPrompt = await page
    .getByText(/continue with google|continue with apple|continue with email|finish signing up|sign in|log in/i)
    .first()
    .isVisible({
      timeout: 2_000,
    })
    .catch(() => false);

  return /\/auth\/|\/login|signin|sign-in/i.test(page.url()) || hasLoginPrompt;
}

async function visible(locator: Locator, timeoutMs = 1_000) {
  return locator
    .waitFor({
      state: "visible",
      timeout: timeoutMs,
    })
    .then(() => true)
    .catch(() => false);
}

async function snapshotControls(page: Page): Promise<ControlSnapshot[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("button,a,input,textarea,[role='button']"))
      .slice(0, 250)
      .map((node) => {
        const element = node as HTMLElement;
        const formElement = node as HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement;
        const text = element.innerText?.trim() || element.textContent?.trim() || null;
        const parentText = element.parentElement?.innerText?.trim() || null;
        const rect = element.getBoundingClientRect();

        return {
          tag: element.tagName.toLowerCase(),
          text,
          ariaLabel: element.getAttribute("aria-label"),
          role: element.getAttribute("role"),
          type: formElement.type ?? null,
          href: element instanceof HTMLAnchorElement ? element.href : null,
          disabled: "disabled" in formElement ? Boolean(formElement.disabled) : element.getAttribute("aria-disabled") === "true",
          className: typeof element.className === "string" ? element.className : null,
          visibleTextHint: parentText?.slice(0, 180) ?? null,
          title: element.getAttribute("title"),
          dataTestId: element.getAttribute("data-testid"),
          svgText: Array.from(element.querySelectorAll("svg"))
            .map((svg) => svg.outerHTML.slice(0, 240))
            .join("\n") || null,
          rect: rect.width || rect.height ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
          outerHTML: element.outerHTML.slice(0, 800),
        };
      }),
  );
}

async function saveSnapshot(page: Page, artifactDir: string, label: string) {
  await mkdir(artifactDir, { recursive: true });
  const screenshotPath = join(artifactDir, `${label}.png`);
  const controlsPath = join(artifactDir, `${label}-controls.json`);

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });
  await writeFile(
    controlsPath,
    JSON.stringify(
      {
        label,
        url: page.url(),
        controls: await snapshotControls(page),
      },
      null,
      2,
    ),
  );

  console.log(`[crawl] snapshot ${label}`);
  console.log(`[crawl] screenshot: ${screenshotPath}`);
  console.log(`[crawl] controls:   ${controlsPath}`);
}

function submitButtonCandidates(page: Page) {
  return [
    page.locator(opusClipSelectors.submitButton).first(),
    page.getByRole("button", { name: /get clips in 1 click/i }).first(),
    page.locator('button:has-text("Get clips in 1 click")').first(),
    page.locator('[role="button"]:has-text("Get clips in 1 click")').first(),
    page.getByText(/get clips in 1 click/i).first(),
  ];
}

function uploadReadyCandidates(page: Page) {
  return [
    page.getByRole("button", { name: /^remove$/i }).first(),
    page.getByText(/speech language/i).first(),
    page.getByText(/credit usage/i).first(),
    page.getByText(/unauthorized clipping/i).first(),
    page.locator("video").first(),
  ];
}

function uploadProgressCandidates(page: Page) {
  return [
    page.getByText(/uploading\s+\d+(\.\d+)?\s*%/i).first(),
    page.getByText(/\d+\s*(min|minute|sec|second)s?\s+left/i).first(),
    page.getByRole("button", { name: /^cancel$/i }).first(),
  ];
}

async function firstVisible(candidates: Locator[], timeoutMs: number) {
  for (const candidate of candidates) {
    if (await visible(candidate, timeoutMs)) {
      return candidate;
    }
  }

  return null;
}

function popupDismissCandidates(page: Page) {
  return [
    page.getByRole("button", { name: /^close$/i }).first(),
    page.getByRole("button", { name: /continue|got it|ok|done|maybe later|not now|skip/i }).first(),
    page.locator('button[aria-label*="close" i]').first(),
    page.locator('button:has-text("×"), button:has-text("x")').first(),
  ];
}

async function dismissSoftPopups(page: Page) {
  await page.keyboard.press("Escape").catch(() => undefined);

  for (const candidate of popupDismissCandidates(page)) {
    if (!(await candidate.isVisible({ timeout: 500 }).catch(() => false))) {
      continue;
    }

    await candidate.click({ timeout: 1_000 }).catch(() => undefined);
    await page.waitForTimeout(1_000);
  }
}

async function waitForProjectContent(page: Page) {
  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    await dismissSoftPopups(page);

    const hasOriginalClips = await page.getByText(/original clips/i).first().isVisible({ timeout: 1_000 }).catch(() => false);
    const hasClipTiles = await page.locator("img, video").count().then((count) => count > 0).catch(() => false);

    if (hasOriginalClips || hasClipTiles) {
      return;
    }

    await page.waitForTimeout(2_000);
  }
}

function downloadButtonCandidates(page: Page) {
  return [
    page.getByRole("button", { name: /download hd|download|export/i }),
    page.locator('button[aria-label*="download" i], a[aria-label*="download" i]'),
    page.locator('button:has(img[alt*="download" i]), button:has(img[src*="download-icon"])'),
    page.locator('a[href*="download"], a[href*=".mp4"]'),
  ];
}

async function countDownloadCandidates(page: Page) {
  let count = 0;

  for (const locator of downloadButtonCandidates(page)) {
    count += await locator.count().catch(() => 0);
  }

  return count;
}

async function waitForUploadReady(page: Page, artifactDir: string) {
  const deadline = Date.now() + 15 * 60 * 1000;

  while (Date.now() < deadline) {
    const progress = await firstVisible(uploadProgressCandidates(page), 500);

    if (progress) {
      const text = (await progress.innerText().catch(() => null)) ?? "uploading";
      console.log(`[crawl] upload progress: ${text}`);
      await page.waitForTimeout(3_000);
      continue;
    }

    const ready = await firstVisible(uploadReadyCandidates(page), 1_000);
    const submit = await firstVisible(submitButtonCandidates(page), 1_000);

    if (ready && submit) {
      await saveSnapshot(page, artifactDir, "03-upload-ready");
      return submit;
    }

    await page.waitForTimeout(1_000);
  }

  throw new Error("Timed out waiting for OpusClip upload-ready state.");
}

async function collectProjectPaths(page: Page) {
  const links = page.locator('a[href^="/clip/"], a[href*="/clip/"]');
  const count = Math.min(await links.count().catch(() => 0), 100);
  const paths = new Set<string>();

  for (let index = 0; index < count; index += 1) {
    const href = await links.nth(index).getAttribute("href").catch(() => null);

    if (!href) {
      continue;
    }

    const url = new URL(href, page.url());

    if (url.pathname.startsWith("/clip/")) {
      paths.add(url.pathname);
    }
  }

  return paths;
}

async function waitForProjectAndResults(page: Page, artifactDir: string, existingProjectPaths: Set<string>) {
  const config = getOpusClipConfig();
  const deadline = Date.now() + getCrawlTimeoutMs();

  while (Date.now() < deadline) {
    await dismissSoftPopups(page);

    const currentPath = new URL(page.url()).pathname;
    const isNewProject = currentPath.startsWith("/clip/") && !existingProjectPaths.has(currentPath);
    const downloadCount = await countDownloadCandidates(page);
    const originalClipsVisible = await page.getByText(/original clips/i).first().isVisible({ timeout: 1_000 }).catch(() => false);

    if (isNewProject && originalClipsVisible && downloadCount > 0) {
      await saveSnapshot(page, artifactDir, "05-results-ready");
      console.log(`[crawl] results ready at ${page.url()}`);
      console.log(`[crawl] Download HD buttons: ${downloadCount}`);
      return;
    }

    const newProjectLink = page.locator('a[href^="/clip/"], a[href*="/clip/"]').filter({
      hasNotText: /^$/,
    });
    const linkCount = Math.min(await newProjectLink.count().catch(() => 0), 100);

    for (let index = 0; index < linkCount; index += 1) {
      const link = newProjectLink.nth(index);
      const href = await link.getAttribute("href").catch(() => null);
      const path = href ? new URL(href, page.url()).pathname : null;

      if (path?.startsWith("/clip/") && !existingProjectPaths.has(path) && (await link.isVisible().catch(() => false))) {
        console.log(`[crawl] opening new project ${path}`);
        await page.goto(new URL(path, new URL(config.appUrl).origin).toString(), {
          waitUntil: "domcontentloaded",
        });
        await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
        await saveSnapshot(page, artifactDir, "04-project-opened");
        break;
      }
    }

    console.log(`[crawl] waiting for results. url=${page.url()} downloadButtons=${downloadCount}`);
    await page.waitForTimeout(10_000);
  }

  throw new Error(`Timed out waiting for OpusClip results after ${Math.round(getCrawlTimeoutMs() / 1000)} seconds.`);
}

async function main() {
  const config = getOpusClipConfig();
  const sourceFile = process.env.OPUSCLIP_CRAWL_PROJECT_PATH ? null : await resolveSourceFile();
  const existingProjectPath = process.env.OPUSCLIP_CRAWL_PROJECT_PATH?.trim();
  const artifactDir = resolve("./artifacts/opusclip-crawl", timestampSlug());

  console.log("[crawl] OpusClip crawler/debugger");
  console.log("[crawl] This uses your saved user-owned session. It does not bypass CAPTCHA, rate limits, or security prompts.");
  console.log(`[crawl] source: ${sourceFile ?? "(skipped; using existing project)"}`);
  console.log(`[crawl] project path: ${existingProjectPath ?? "(new upload)"}`);
  console.log(`[crawl] artifact dir: ${artifactDir}`);
  console.log(`[crawl] click submit: ${isEnabled("OPUSCLIP_CRAWL_CLICK_SUBMIT") ? "yes" : "no"}`);
  console.log(
    `[crawl] browser session: ${
      config.usePersistentContext && isEnabled("OPUSCLIP_CRAWL_USE_PERSISTENT_CONTEXT")
        ? "persistent profile"
        : "isolated storageState"
    }`,
  );

  if (!config.usePersistentContext && !existsSync(config.storageStatePath)) {
    throw new Error(`Missing OpusClip storage state at ${config.storageStatePath}. Run npm run opusclip:login first.`);
  }

  const crawlBrowser = await openBrowser();
  const { browser, context, page } = crawlBrowser;

  try {
    await page.goto(config.appUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

    if (await isLoginPage(page)) {
      throw new Error(`OpusClip session is not logged in. Current URL: ${page.url()}`);
    }

    if (existingProjectPath) {
      const projectPath = existingProjectPath.startsWith("/clip/") ? existingProjectPath : `/clip/${existingProjectPath}`;
      await page.goto(new URL(projectPath, new URL(config.appUrl).origin).toString(), {
        waitUntil: "domcontentloaded",
      });
      await waitForProjectContent(page);
      await saveSnapshot(page, artifactDir, "01-existing-project");
      await waitForProjectAndResults(page, artifactDir, new Set());
      return;
    }

    if (!sourceFile) {
      throw new Error("No source file resolved for OpusClip crawl.");
    }

    await saveSnapshot(page, artifactDir, "01-dashboard");
    const existingProjectPaths = await collectProjectPaths(page);
    const fileInput = page.locator(opusClipSelectors.fileInput).first();

    if (!(await fileInput.count())) {
      const uploadButton = page.locator(opusClipSelectors.uploadButton).first();

      if (await visible(uploadButton, config.selectorTimeoutMs)) {
        await uploadButton.click();
      }
    }

    await fileInput.setInputFiles(sourceFile, {
      timeout: config.selectorTimeoutMs,
    });
    await saveSnapshot(page, artifactDir, "02-file-selected");

    const submitButton = await waitForUploadReady(page, artifactDir);
    const submitText = await submitButton.innerText().catch(() => "Get clips in 1 click");
    const submitHtml = await submitButton.evaluate((node) => node.outerHTML).catch(() => null);

    console.log(`[crawl] submit candidate text: ${submitText}`);
    console.log(`[crawl] submit candidate html: ${submitHtml}`);

    if (!isEnabled("OPUSCLIP_CRAWL_CLICK_SUBMIT")) {
      console.log("[crawl] stopping before submit. Set OPUSCLIP_CRAWL_CLICK_SUBMIT=true to click and wait for clips.");
      return;
    }

    await submitButton.click({ timeout: config.selectorTimeoutMs }).catch(async () => {
      await submitButton.evaluate((node) => {
        const button = node instanceof HTMLButtonElement ? node : node.closest("button");
        button?.click();
      });
    });
    await page.waitForTimeout(5_000);
    await saveSnapshot(page, artifactDir, "04-after-submit-click");
    await waitForProjectAndResults(page, artifactDir, existingProjectPaths);
  } finally {
    await context.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
