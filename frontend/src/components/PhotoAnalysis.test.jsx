import { act, fireEvent, render, screen } from "@testing-library/react";
import PhotoAnalysis from "./PhotoAnalysis";
import API from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn(), post: jest.fn() }));
beforeEach(() => { jest.resetAllMocks(); API.get.mockResolvedValue({ data: { available: true } }); });
const photo = () => new File(["photo"], "photo.jpg", { type: "image/jpeg" });

test("requires consent and explicit confirmation before changing the violation", async () => {
  const select = jest.fn();
  API.post.mockResolvedValue({ data: { violation_type: "Obstruction", reason: "A blocked sidewalk is visible." } });
  render(<PhotoAnalysis file={photo()} onSelect={select} selectedType="No Parking / Wrong Parking" />);
  const analyze = await screen.findByRole("button", { name: "Analyze photo" });
  expect(analyze).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(analyze);
  await screen.findByText("Obstruction"); expect(select).not.toHaveBeenCalled();
  expect(API.post.mock.calls[0][1].get("consent")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Use this suggestion" }));
  expect(select).toHaveBeenCalledWith("Obstruction");
});

test("changing photos discards stale results", async () => {
  let finish;
  API.post.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { rerender } = render(<PhotoAnalysis file={photo()} onSelect={jest.fn()} />);
  await screen.findByRole("button", { name: "Analyze photo" });
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Analyze photo" }));
  rerender(<PhotoAnalysis file={photo()} onSelect={jest.fn()} />);
  await act(async () => finish({ data: { violation_type: "Obstruction", reason: "old" } }));
  expect(screen.queryByText("Obstruction")).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox")).not.toBeChecked();
});

test("videos and unavailable configuration do not call the AI", async () => {
  render(<PhotoAnalysis file={new File(["clip"], "clip.mp4", { type: "video/mp4" })} onSelect={jest.fn()} />);
  await screen.findByText(/supports photos only/);
  expect(API.post).not.toHaveBeenCalled();
});

test("failure keeps manual reporting available", async () => {
  API.post.mockRejectedValue({ response: { data: { detail: "Provider quota unavailable. Choose manually." } } });
  render(<PhotoAnalysis file={photo()} onSelect={jest.fn()} />);
  await screen.findByRole("button", { name: "Analyze photo" });
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Analyze photo" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Choose manually.");
});
