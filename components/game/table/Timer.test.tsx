import { act } from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import Timer from "@/components/game/table/Timer";

describe("Timer Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should display the initial time as \"--:--\"", () => {
    render(<Timer timer={null} />);
    expect(screen.getByText("--:--")).toBeInTheDocument();
  });

  it("should display formatted time correctly", () => {
    render(<Timer timer={65} />);

    act(() => {
      vi.advanceTimersByTime(65000); // 65 seconds
    });

    expect(screen.getByText("01:05")).toBeInTheDocument();
  });
});
