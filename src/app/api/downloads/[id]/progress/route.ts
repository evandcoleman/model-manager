import { getJobManager } from "@/lib/download/job-manager";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const jobManager = getJobManager();
  const job = jobManager.getJob(id);

  if (!job) {
    return new Response("Job not found", { status: 404 });
  }

  // Set up SSE stream
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(job)}\n\n`)
      );

      // If already completed, close immediately
      if (
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "cancelled"
      ) {
        controller.close();
        return;
      }

      // Subscribe to updates
      unsubscribe = jobManager.subscribe(id, (updatedJob) => {
        if (closed) return;

        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(updatedJob)}\n\n`)
          );

          // Close stream when download completes
          if (
            updatedJob.status === "completed" ||
            updatedJob.status === "failed" ||
            updatedJob.status === "cancelled"
          ) {
            closed = true;
            controller.close();
          }
        } catch {
          // Stream closed
          closed = true;
        }
      });
    },
    cancel() {
      closed = true;
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
