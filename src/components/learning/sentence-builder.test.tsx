import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SentenceBuilder, type Token } from "./sentence-builder";

const tokens: Token[] = ["you.", "I", "miss"].map((text, id) => ({ id, text }));

function Harness({ onChange }: { onChange?: (placed: number[]) => void }) {
  const [placed, setPlaced] = useState<number[]>([]);
  return (
    <SentenceBuilder
      tokens={tokens}
      placed={placed}
      onChange={(next) => {
        setPlaced(next);
        onChange?.(next);
      }}
    />
  );
}

describe("SentenceBuilder", () => {
  it("builds a sentence by tapping words in order", () => {
    const changes: number[][] = [];
    render(<Harness onChange={(p) => changes.push(p)} />);
    fireEvent.click(screen.getByRole("button", { name: "Add I" }));
    fireEvent.click(screen.getByRole("button", { name: "Add miss" }));
    fireEvent.click(screen.getByRole("button", { name: "Add you." }));
    expect(changes.at(-1)).toEqual([1, 2, 0]);
    expect(screen.getByLabelText("Your sentence")).toHaveTextContent("Imissyou.");
  });

  it("removes a placed word when tapped and reorders with arrow keys", () => {
    const changes: number[][] = [];
    render(<Harness onChange={(p) => changes.push(p)} />);
    fireEvent.click(screen.getByRole("button", { name: "Add miss" }));
    fireEvent.click(screen.getByRole("button", { name: "Add I" }));
    fireEvent.keyDown(screen.getByRole("button", { name: /^I, position 2/ }), { key: "ArrowLeft" });
    expect(changes.at(-1)).toEqual([1, 2]);
    fireEvent.click(screen.getByRole("button", { name: /^miss, position 2/ }));
    expect(changes.at(-1)).toEqual([1]);
    expect(screen.getByRole("button", { name: "Add miss" })).toBeInTheDocument();
  });
});
