import { describe, expect, it } from "vitest";
import { classifyVantageError, VantageApiError } from "./api-error";

function err(status: number, problem?: object): VantageApiError {
  return new VantageApiError({ status, problem });
}

describe("classifyVantageError", () => {
  it.each([
    [0, undefined, "network"],
    [401, { detail: "Invalid Credentials" }, "auth"],
    [403, { detail: "product is not enabled for this client" }, "forbidden"],
    [404, { detail: "resource not found" }, "not_found"],
    [409, { detail: "kit already activated" }, "conflict"],
    [
      422,
      {
        detail:
          'event "payment_complete" is not a valid transition from the order\'s current status',
      },
      "invalid_transition",
    ],
    [500, { detail: "boom" }, "upstream"],
  ] as const)("status %s → %s", (status, problem, category) => {
    expect(classifyVantageError(err(status, problem)).category).toBe(category);
  });

  it("classifies field-level validation and surfaces the fields", () => {
    const c = classifyVantageError(
      err(400, {
        detail: "One or more required fields are missing or invalid",
        invalid_fields: [
          {
            field: "PhoneNumber",
            message:
              "PhoneNumber is not a valid phone number for the provided country code",
            tag: "phone_with_country",
            value: "x",
          },
        ],
      }),
    );
    expect(c.category).toBe("validation");
    expect(c.invalidFields).toEqual([
      {
        field: "PhoneNumber",
        message: expect.stringContaining("valid phone number"),
      },
    ]);
  });

  it("sanitizes internal supplier naming out of the friendly message", () => {
    const c = classifyVantageError(
      err(400, {
        detail:
          "Supplier with ID 1 only supports shipping to the following country codes: GB.",
      }),
    );
    expect(c.friendlyMessage).not.toMatch(/supplier with id/i);
    expect(c.friendlyMessage).toContain("GB");
    expect(c.rawDetail).toContain("Supplier with ID 1");
  });

  it("surfaces the 422 reason verbatim (the API names the problem)", () => {
    const c = classifyVantageError(
      err(422, {
        detail:
          'event "completed" is not a valid transition from the order\'s current status',
      }),
    );
    expect(c.friendlyMessage).toContain("not a valid transition");
  });
});
