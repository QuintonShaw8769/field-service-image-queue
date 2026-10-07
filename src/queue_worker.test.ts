import assert from "node:assert/strict";
import { buildJobs, workOrderSchema } from "./queue_worker.js";

const order = workOrderSchema.parse({ workOrderId: "WO-1", technicianId: "tech-a", photos: [{ filename: "front.jpg", image: "img" }, { filename: "back.jpg", image: "img2" }] });
const jobs = buildJobs(order);
assert.equal(jobs.length, 2);
assert.equal(jobs[0].status, "queued");
assert.equal(jobs[1].sequence, 2);
assert.throws(() => workOrderSchema.parse({ workOrderId: "", technicianId: "tech-a", photos: [] }));
console.log("queue decision test passed");
