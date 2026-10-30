import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AdminDashboard from "./AdminDashboard";
import API from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() }));
jest.mock("./HotspotMap", () => () => null);
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn(),
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

let officers;
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.setItem("ctmo_admin_authenticated", "true");
  officers = [];
  API.get.mockImplementation((url) => Promise.resolve({ data: url === "admin/officers/" ? officers : [] }));
});
afterEach(() => sessionStorage.clear());

test("admin adds, edits and confirms deletion of a persisted officer", async () => {
  API.post.mockImplementation((_url, values) => { officers = [{ id: 1, ...values }]; return Promise.resolve({ data: officers[0] }); });
  API.patch.mockImplementation((_url, values) => { officers = [{ id: 1, ...values }]; return Promise.resolve({ data: officers[0] }); });
  API.delete.mockImplementation(() => { officers = []; return Promise.resolve({}); });
  render(<AdminDashboard />);
  fireEvent.click(screen.getByRole("button", { name: "Case Assignment" }));
  fireEvent.click(screen.getByRole("button", { name: "Add Officer" }));
  const dialog = screen.getByRole("dialog", { name: "Add Officer" });
  fireEvent.change(within(dialog).getByLabelText("Officer name *"), { target: { value: "Officer Garcia" } });
  fireEvent.change(within(dialog).getByLabelText("Badge number *"), { target: { value: "CTMO-900" } });
  fireEvent.change(within(dialog).getByLabelText("Unit / team *"), { target: { value: "Patrol" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save Officer" }));
  expect(await screen.findByRole("button", { name: "Edit Officer Garcia" })).toBeInTheDocument();
  expect(API.post).toHaveBeenCalledWith("admin/officers/", { name: "Officer Garcia", badge: "CTMO-900", unit: "Patrol" });
  fireEvent.click(screen.getByRole("button", { name: "Edit Officer Garcia" }));
  fireEvent.change(screen.getByLabelText("Officer name *"), { target: { value: "Officer Garcia Jr." } });
  fireEvent.click(screen.getByRole("button", { name: "Save Officer" }));
  fireEvent.click(await screen.findByRole("button", { name: "Delete Officer Garcia Jr." }));
  expect(API.delete).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete Officer" }));
  await waitFor(() => expect(API.delete).toHaveBeenCalledWith("admin/officers/1/"));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  await waitFor(() => expect(screen.queryByText("Officer Garcia Jr.")).not.toBeInTheDocument());
});

test("an officer with active cases stays listed when deletion is rejected", async () => {
  officers = [{ id: 1, name: "Officer Garcia", badge: "CTMO-900", unit: "Patrol" }];
  API.delete.mockRejectedValue({ response: { data: { detail: "This officer has active cases. Reassign or resolve them before deleting the officer." } } });
  render(<AdminDashboard />);
  fireEvent.click(screen.getByRole("button", { name: "Case Assignment" }));
  fireEvent.click(await screen.findByRole("button", { name: "Delete Officer Garcia" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete Officer" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("This officer has active cases.");
  expect(screen.getByRole("button", { name: "Edit Officer Garcia" })).toBeInTheDocument();
});
