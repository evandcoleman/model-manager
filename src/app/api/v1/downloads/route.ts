import { NextRequest, NextResponse } from "next/server";
import { getJobManager } from "@/lib/download/job-manager";
import { withApiAuth } from "@/lib/api-auth";

export interface CreateJobOptions {
  url: string;
  outputDir?: string;
  modelType?: string;
  baseModel?: string;
}

async function getHandler(_request: NextRequest) {
  const jobManager = getJobManager();
  const jobs = jobManager.getAllJobs();
  return NextResponse.json({ jobs });
}

async function postHandler(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateJobOptions;
    const { url, outputDir, modelType, baseModel } = body;

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const jobManager = getJobManager();
    const source = jobManager.detectSource(url);

    if (!source) {
      return NextResponse.json(
        {
          error:
            "Unsupported URL. Supported sources: civarchive, civitai, huggingface",
        },
        { status: 400 }
      );
    }

    const job = await jobManager.createJob(url, {
      outputDir,
      modelType,
      baseModel,
    });
    return NextResponse.json({ job });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create job" },
      { status: 500 }
    );
  }
}

async function deleteHandler(_request: NextRequest) {
  const jobManager = getJobManager();
  jobManager.clearCompleted();
  return NextResponse.json({ success: true });
}

export const GET = withApiAuth(getHandler);
export const POST = withApiAuth(postHandler);
export const DELETE = withApiAuth(deleteHandler);
