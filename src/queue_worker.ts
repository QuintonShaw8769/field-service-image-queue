import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";

const RESIZE_CAPABILITY = "image.resize";
const WORK_QUEUE = "field-service-images";

export const workOrderSchema = z.object({
  workOrderId: z.string().min(1),
  technicianId: z.string().min(1),
  photos: z.array(z.object({ filename: z.string().min(1), image: z.string().min(1) })).min(1)
});
export type WorkOrder = z.infer<typeof workOrderSchema>;

export function buildJobs(order: WorkOrder) {
  return order.photos.map((photo, index) => ({
    workOrderId: order.workOrderId, technicianId: order.technicianId,
    filename: photo.filename, image: photo.image, sequence: index + 1, status: "queued" as const
  }));
}

export async function dispatch(orderInput: unknown, client: InfraiClient) {
  const order = workOrderSchema.parse(orderInput);
  const jobs = buildJobs(order);
  for (const job of jobs) await client.request("/v1/queue/publish", "POST", { queue: WORK_QUEUE, payload: job });
  return { workOrderId: order.workOrderId, queued: jobs.length };
}

export async function processOne(message: { payload: WorkJob }, client: InfraiClient) {
  const uploaded = await client.request<{ id: string }>("/v1/image/upload", "POST", {
    file: message.payload.image, filename: message.payload.filename
  });
  const resized = await client.request<{ id: string }>("/v1/image/resize", "POST", {
    image: uploaded.id, width: 1600, height: 1200, fit: "inside", enlarge: false, format: "jpeg", store: true
  });
  return { workOrderId: message.payload.workOrderId, technicianId: message.payload.technicianId, imageId: resized.id, status: "processed" };
}

type WorkJob = ReturnType<typeof buildJobs>[number];

async function main() {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running the worker");
  const client = new InfraiClient(key);
  const sample = { workOrderId: "WO-1042", technicianId: "tech-17", photos: [{ filename: "panel.jpg", image: "base64-image-data" }] };
  console.log(await dispatch(sample, client));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(error => { console.error(error); process.exitCode = 1; });
