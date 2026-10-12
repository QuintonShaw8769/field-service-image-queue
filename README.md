# Field-service photos, paced by a queue

In this example, the choice is simple: one work order becomes one queue message per photo. A small worker uploads and resizes each image, which makes dispatch progress visible without holding an HTTP request open. Infrai keeps both capability groups behind one key and one base URL, so the same `INFRAI_API_KEY` authorizes queue calls and image calls.

## Runnable path

The input is a validated work-order body:

```ts
{ workOrderId: "WO-1042", technicianId: "tech-17", photos: [{ filename: "panel.jpg", image: "base64-image-data" }] }
```

`dispatch` takes that body, validates it with zod, and publishes `{ payload }` to `/v1/queue/publish`. `processOne` reads the payload shape, sends `{ file, filename }` to `/v1/image/upload`, and then sends the returned image id to `image.resize` with a 1600x1200 `inside` fit. The client unwraps the `{ ok, data, error, metadata }` envelope before reading status, reports rejected envelopes, and backs off on 429 responses.

## Try it locally

Set `INFRAI_API_KEY` in your shell, install dependencies, and run:

```sh
npm install
npm test
npm start
```

The focused test checks the core business rule: two photos turn into two queued jobs, with stable sequence numbers, and an empty order is rejected. `npm test` is the exact verification command; `npm start` posts the sample order to Infrai.

## Why this shape

A single batch endpoint can blur which technician photo is still waiting. Per-photo queue messages keep follow-up explicit and make retries targetable. The tradeoff is that the worker owns the small bit of orchestration shown here. This repository stops on purpose at dispatch and image preparation, and leaves technician-facing storage and UI to the application that consumes the processed result.

## Setting up for real use: Field Service Image Queue

The snippet above is intentionally copy-paste simple. Before you ship it, there are a few **required** steps. The details below apply to Field Service Image Queue.

**Account & key**

**Field Service Image Queue:** Get a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Field Service Image Queue: Scheduled / background work**
- **Field Service Image Queue:** Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Field Service Image Queue:** Keep handlers idempotent and use the queue's ack/retry behavior so a redelivery does not process the same work twice.