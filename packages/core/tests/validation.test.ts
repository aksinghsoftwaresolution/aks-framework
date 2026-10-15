import { describe, expect, it } from "vitest";

import type { RequestContext } from "../src/context.js";
import { ValidationError } from "../src/errors.js";
import {
  validateRequest,
} from "../src/validation-middleware.js";

function createContext(
  overrides: Partial<RequestContext> = {},
): RequestContext {
  return {
    request: {
      method: "POST",
      path: "/users",
      headers: {},
    },
    params: {
      id: "123",
    },
    query: {
      page: "1",
    },
    body: {
      name: "Adison",
    },
    validated: {},
    response: {} as RequestContext["response"],
    ...overrides,
  };
}

describe("Request validation", () => {
  it("stores validated body data separately from the raw body", async () => {
    const ctx = createContext();

    let nextCalled = false;

    await validateRequest(
      ctx,
      {
        body: (input) => ({
          success: true,
          data: {
            ...(input as Record<string, unknown>),
            validated: true,
          },
        }),
      },
      async () => {
        nextCalled = true;
      },
    );

    expect(nextCalled).toBe(true);

    expect(ctx.body).toEqual({
      name: "Adison",
    });

    expect(ctx.validated.body).toEqual({
      name: "Adison",
      validated: true,
    });
  });

  it("validates query data", async () => {
    const ctx = createContext();

    await validateRequest(
      ctx,
      {
        query: (input) => ({
          success: true,
          data: {
            page: Number(input.page),
          },
        }),
      },
      async () => {},
    );

    expect(ctx.query).toEqual({
      page: "1",
    });

    expect(ctx.validated.query).toEqual({
      page: 1,
    });
  });

  it("validates params data", async () => {
    const ctx = createContext();

    await validateRequest(
      ctx,
      {
        params: (input) => ({
          success: true,
          data: {
            id: Number(input.id),
          },
        }),
      },
      async () => {},
    );

    expect(ctx.params).toEqual({
      id: "123",
    });

    expect(ctx.validated.params).toEqual({
      id: 123,
    });
  });

  it("aggregates validation issues", async () => {
    const ctx = createContext();

    await expect(
      validateRequest(
        ctx,
        {
          body: () => ({
            success: false,
            issues: [
              {
                source: "body",
                path: "name",
                message: "Name is required",
                code: "REQUIRED",
              },
            ],
          }),
          query: () => ({
            success: false,
            issues: [
              {
                source: "query",
                path: "page",
                message: "Page must be a number",
                code: "INVALID_NUMBER",
              },
            ],
          }),
        },
        async () => {},
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "VALIDATION_ERROR",
      issues: [
        {
          source: "body",
          path: "name",
          message: "Name is required",
          code: "REQUIRED",
        },
        {
          source: "query",
          path: "page",
          message: "Page must be a number",
          code: "INVALID_NUMBER",
        },
      ],
    });
  });

  it("does not call next when validation fails", async () => {
    const ctx = createContext();

    let nextCalled = false;

    await expect(
      validateRequest(
        ctx,
        {
          body: () => ({
            success: false,
            issues: [
              {
                source: "body",
                path: "name",
                message: "Name is required",
              },
            ],
          }),
        },
        async () => {
          nextCalled = true;
        },
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(nextCalled).toBe(false);
  });

  it("does not overwrite validated data from successful sources when another source fails", async () => {
    const ctx = createContext();

    await expect(
      validateRequest(
        ctx,
        {
          body: () => ({
            success: true,
            data: {
              name: "Validated",
            },
          }),
          query: () => ({
            success: false,
            issues: [
              {
                source: "query",
                path: "page",
                message: "Invalid page",
              },
            ],
          }),
        },
        async () => {},
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(ctx.validated.body).toEqual({
      name: "Validated",
    });

    expect(ctx.validated.query).toBeUndefined();
  });

  
});