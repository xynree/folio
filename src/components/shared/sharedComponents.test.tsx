import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { Plus } from "lucide-react";
import { makeItem } from "../../test/fixtures";
import { ButtonIcon } from "./ButtonIcon";
import { CanvasDots } from "./CanvasDots";
import { EmptyState } from "./EmptyState";
import { LazyThumbnail } from "./LazyThumbnail";

describe("shared components", () => {
  it("renders button icons as decorative svg content", () => {
    render(<ButtonIcon icon={Plus} size={20} />);

    const icon = document.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.getAttribute("width")).toBe("20");
  });

  it("renders canvas membership dots and the empty state", () => {
    const { rerender } = render(<CanvasDots colors={["#111111", "#222222"]} />);

    expect(screen.getByLabelText("2 boards")).not.toBeNull();
    expect(document.querySelectorAll(".canvas-membership-dots span")).toHaveLength(2);

    rerender(<CanvasDots colors={[]} />);
    expect(document.querySelector(".canvas-membership-dots.empty")).not.toBeNull();
  });

  it("renders empty state copy", () => {
    render(<EmptyState label="Nothing here" />);

    expect(screen.getByText("Nothing here")).not.toBeNull();
  });

  it("requests thumbnails when visible and stores returned URLs", async () => {
    const setThumbUrls = vi.fn();
    vi.mocked(window.folio.ensureThumbnails).mockResolvedValue({
      alpha: "folio://thumb/alpha.jpg",
    });

    render(
      <LazyThumbnail
        item={makeItem("alpha")}
        thumbUrls={{}}
        setThumbUrls={setThumbUrls}
      />,
    );

    expect(screen.getByText("Preview")).not.toBeNull();
    await waitFor(() =>
      expect(window.folio.ensureThumbnails).toHaveBeenCalledWith(["alpha"]),
    );
    await waitFor(() => expect(setThumbUrls).toHaveBeenCalled());
  });

  it("uses existing thumbnails and missing placeholders without requesting", () => {
    const setThumbUrls = vi.fn();

    render(
      <LazyThumbnail
        item={makeItem("missing", { missing: true })}
        thumbUrls={{ missing: "folio://thumb/missing.jpg" }}
        setThumbUrls={setThumbUrls}
      />,
    );

    expect(document.querySelector("img")?.getAttribute("src")).toBe(
      "folio://thumb/missing.jpg",
    );
    expect(window.folio.ensureThumbnails).not.toHaveBeenCalled();
  });
});
