import { timingSafeEqual } from "node:crypto";

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

import { handleParseRequest } from "../parser/request.js";

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (!authorized(event.headers["x-app-secret"])) {
    return json(401, { error: "unauthorized" });
  }
  if (event.requestContext.http.method !== "POST") {
    return json(405, { error: "method not allowed" });
  }

  const { status, body } = await handleParseRequest(event.body);
  return json(status, body);
}

function authorized(secret: string | undefined): boolean {
  const expected = process.env.APP_SECRET;
  if (!expected || !secret) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(statusCode: number, payload: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  };
}
