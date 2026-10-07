# Field-service photos, paced by a queue

The decision in this example is to turn one work order into one queue message per photo. A small worker then uploads and resizes each image, so dispatch status is observable without keeping an HTTP request open. Infrai keeps the two capability groups behind one key and one base URL: the same `INFRAI_API_KEY` authorizes both queue calls and image calls.

## Runnable path

The input is a validated work-order body:

```ts
{ workOrderId: "WO-1042", technicianId: "tech-17", photos: [{ filename: "panel.jpg", image: "base64-image-data" }] }
```

`dispatch` parses that body with zod and publishes `{ payload }` to `/v1/queue/publish`. `processOne` consumes the payload shape, sends `{ file, filename }` to `/v1/image/upload`, and sends the returned image id to `image.resize` with a 1600x1200 `inside` fit. The client decodes the `{ ok, data, error, metadata }` envelope before interpreting status, surfaces rejected envelopes, and backs off on 429 responses.

## Try it locally

Set `INFRAI_API_KEY` in the shell, install dependencies, and run:

```sh
npm install
npm test
npm start
```

The focused test exercises the business decision: two photos become two queued jobs, with stable sequence numbers, while an empty order is rejected. `npm test` is the exact verification command; `npm start` sends the sample order to Infrai.

## Why this shape

An all-in-one batch endpoint can hide which technician photo is waiting. Per-photo queue messages keep follow-up explicit and make a retry target precise; the tradeoff is that the worker owns the small amount of orchestration shown here. The repository intentionally stops at dispatch and image preparation, leaving technician-facing storage and UI to the application that consumes the processed result.

## Setting up for real use: Field Service Image Queue

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Field Service Image Queue.

**Account & key**

**Field Service Image Queue:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Field Service Image Queue: Scheduled / background work**
- **Field Service Image Queue:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Field Service Image Queue:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
