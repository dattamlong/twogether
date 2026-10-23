import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AnswerFeedback, QuestionCard } from "@/features/learning/types";
import { QuestionView } from "./question-view";

const card = {
  id: "q1",
  lesson_id: "l1",
  position: 1,
  kind: "multiple_choice",
  level: "A1",
  objective: "Use 'a' before consonant sounds",
  prompt: "I have ___ cat.",
  prompt_vi: "Tôi có một con mèo.",
  options: ["a", "an", "the"],
  tokens: null,
  audio_text: null,
  hint: null,
  hint_vi: null,
  category_id: "grammar",
} as QuestionCard;

const feedback = (correct: boolean, attemptNo = 1): AnswerFeedback => ({
  correct,
  attemptNo,
  correctAnswer: "a",
  acceptedAnswers: null,
  explanation: "Use 'a' before a consonant sound.",
  explanationVi: "Dùng 'a' trước phụ âm.",
  word: null,
  newlyLearned: false,
});

describe("QuestionView", () => {
  it("shows gentle feedback with the correct answer, then allows a retry", async () => {
    const submit = vi.fn().mockResolvedValueOnce(feedback(false)).mockResolvedValueOnce(feedback(true, 2));
    const onDone = vi.fn();
    render(<QuestionView card={card} submit={submit} onDone={onDone} />);

    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "an" }));
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByText(/Correct answer:/)).toHaveTextContent("Correct answer: a");
    expect(screen.getByText("Dùng 'a' trước phụ âm.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "an" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(screen.getByRole("radio", { name: "a" }));
    fireEvent.click(await screen.findByRole("button", { name: "Check" }));
    await waitFor(() => expect(submit).toHaveBeenLastCalledWith("a"));
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ firstTryCorrect: false }));
  });

  it("reports a first-try correct answer", async () => {
    const onDone = vi.fn();
    render(<QuestionView card={card} submit={vi.fn().mockResolvedValue(feedback(true))} onDone={onDone} />);
    fireEvent.click(screen.getByRole("radio", { name: "a" }));
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ firstTryCorrect: true }));
  });
});
