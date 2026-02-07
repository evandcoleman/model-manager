import { NextResponse } from "next/server";
import { getJobManager } from "@/lib/download/job-manager";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const jobManager = getJobManager();
  const job = jobManager.getJob(id);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const jobManager = getJobManager();
  const cancelled = jobManager.cancelJob(id);

  if (cancelled) {
    return NextResponse.json({ success: true, message: "Download cancelled" });
  }

  const job = jobManager.getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: false,
    message: "Download is not active",
    status: job.status,
  });
}
