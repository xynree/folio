import { describe, expect, it } from "vitest";
import {
  addDays,
  formatBoardTimestamp,
  formatReviewTimestamp,
  formatShortDate,
  parseTimestamp,
} from "./dates";

const SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

const TIMESTAMP_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

const VALID_ISO = "2026-06-17T16:05:00.000Z";

function expectedFormat(
  value: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

describe("formatShortDate", () => {
  it("returns 'None' for empty input", () => {
    expect(formatShortDate(null)).toBe("None");
    expect(formatShortDate("")).toBe("None");
  });

  it("returns 'Unknown' for unparseable input", () => {
    expect(formatShortDate("not-a-date")).toBe("Unknown");
  });

  it("formats a valid date as a short calendar date", () => {
    expect(formatShortDate(VALID_ISO)).toBe(
      expectedFormat(VALID_ISO, SHORT_DATE_OPTIONS),
    );
  });
});

describe("formatReviewTimestamp", () => {
  it("returns 'Unknown date' for unparseable input", () => {
    expect(formatReviewTimestamp("nope")).toBe("Unknown date");
  });

  it("formats a valid date as a short calendar date", () => {
    expect(formatReviewTimestamp(VALID_ISO)).toBe(
      expectedFormat(VALID_ISO, SHORT_DATE_OPTIONS),
    );
  });
});

describe("formatBoardTimestamp", () => {
  it("returns 'Unknown' for empty or invalid input", () => {
    expect(formatBoardTimestamp()).toBe("Unknown");
    expect(formatBoardTimestamp("")).toBe("Unknown");
    expect(formatBoardTimestamp("not-a-date")).toBe("Unknown");
  });

  it("formats a valid date with time of day", () => {
    expect(formatBoardTimestamp(VALID_ISO)).toBe(
      expectedFormat(VALID_ISO, TIMESTAMP_OPTIONS),
    );
  });
});

describe("addDays", () => {
  it("returns a new date offset by the given number of days", () => {
    const base = new Date("2026-06-17T12:00:00.000Z");
    const result = addDays(base, 5);
    expect(result.getDate()).toBe(22);
    expect(result).not.toBe(base);
    expect(base.getDate()).toBe(17);
  });

  it("supports negative offsets and month rollover", () => {
    const base = new Date("2026-03-02T12:00:00.000Z");
    const result = addDays(base, -5);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(25);
  });
});

describe("parseTimestamp", () => {
  it("returns the epoch milliseconds for a valid date", () => {
    expect(parseTimestamp(VALID_ISO)).toBe(Date.parse(VALID_ISO));
  });

  it("returns 0 for empty or unparseable input", () => {
    expect(parseTimestamp("")).toBe(0);
    expect(parseTimestamp("not-a-date")).toBe(0);
  });
});
