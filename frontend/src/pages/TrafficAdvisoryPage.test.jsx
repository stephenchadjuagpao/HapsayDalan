import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TrafficAdvisoryPage from "./TrafficAdvisoryPage";
import API from "../services/api";

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: "/advisory" }),
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

jest.mock("../services/api", () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}));

const mockAdvisories = [
  {
    id: 101,
    title: "Urgent Road Closure: Bilang-Bilang St.",
    category: "Road Closure",
    message: "Temporary closure due to emergency pipe rehabilitation.",
    affected_location: "Bilang-Bilang St. / Boulevard",
    alternative_route: "Take Borromeo St.",
    is_pinned: true,
    status: "published",
    likes_count: 5,
    comments_count: 2,
    created_at: "2026-11-06T10:00:00Z",
    recent_comments: [
      { id: 1, author_name: "Maria Santos", comment: "Thank you for the early advisory!" }
    ],
  },
  {
    id: 102,
    title: "Road Construction Notice",
    category: "Construction",
    message: "Asphalt overlay operations along Taft St.",
    affected_location: "Taft St.",
    alternative_route: "Reroute through Kaskag",
    is_pinned: false,
    status: "published",
    likes_count: 2,
    comments_count: 0,
    created_at: "2026-11-06T08:30:00Z",
    recent_comments: [],
  },
];

describe("TrafficAdvisoryPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    API.get.mockImplementation((url) => {
      if (url.includes("admin/me")) {
        return Promise.resolve({ data: { is_staff: true, username: "admin" } });
      }
      return Promise.resolve({ data: mockAdvisories });
    });
  });

  test("renders official CTMO feed and announcements with details", async () => {
    render(<TrafficAdvisoryPage />);

    // Profile and Page branding
    expect(await screen.findByText("CTMO Surigao City")).toBeInTheDocument();
    expect(screen.getByText(/City Hall Complex, Surigao City/i)).toBeInTheDocument();

    // Announcements
    expect(await screen.findByText("Urgent Road Closure: Bilang-Bilang St.")).toBeInTheDocument();
    expect(screen.getByText("PINNED ANNOUNCEMENT · HIGH PRIORITY")).toBeInTheDocument();
    expect(screen.getByText("Bilang-Bilang St. / Boulevard")).toBeInTheDocument();
    expect(screen.getByText("Take Borromeo St.")).toBeInTheDocument();
    expect(screen.getByText("Road Construction Notice")).toBeInTheDocument();
  });

  test("category filter filters announcements by category", async () => {
    render(<TrafficAdvisoryPage />);

    await screen.findByText("Urgent Road Closure: Bilang-Bilang St.");

    const constructionPill = screen.getByRole("button", { name: /Construction/i });
    fireEvent.click(constructionPill);

    await waitFor(() => {
      expect(API.get).toHaveBeenCalledWith(expect.stringContaining("category=Construction"));
    });
  });

  test("liking an announcement sends API request and updates count", async () => {
    API.post.mockResolvedValueOnce({ data: { liked: true, likes_count: 6 } });

    render(<TrafficAdvisoryPage />);

    await screen.findByText("Urgent Road Closure: Bilang-Bilang St.");

    const likeButtons = screen.getAllByRole("button", { name: /Like/i });
    fireEvent.click(likeButtons[0]);

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith(
        "advisories/101/like/",
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  test("public users cannot see composer card or admin tabs", async () => {
    // Non-admin user
    API.get.mockImplementation((url) => {
      if (url.includes("admin/me")) {
        return Promise.reject(new Error("Unauthorized"));
      }
      return Promise.resolve({ data: mockAdvisories });
    });

    render(<TrafficAdvisoryPage />);

    expect(await screen.findByText("CTMO Surigao City")).toBeInTheDocument();
    // Composer card should NOT be in the document
    expect(screen.queryByText(/Create an announcement, road closure, or traffic alert/i)).not.toBeInTheDocument();
    // Admin tabs should NOT be in the document
    expect(screen.queryByRole("button", { name: "Drafts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archived" })).not.toBeInTheDocument();
  });

  test("public users can see and click notification subscription button", async () => {
    API.get.mockImplementation((url) => {
      if (url.includes("admin/me")) {
        return Promise.reject(new Error("Unauthorized"));
      }
      return Promise.resolve({ data: mockAdvisories });
    });

    render(<TrafficAdvisoryPage />);

    const notifyBtns = await screen.findAllByRole("button", { name: /Advisory Alerts Active/i });
    expect(notifyBtns.length).toBeGreaterThan(0);
  });

  test("clicking different categories does not trigger duplicate notifications", async () => {
    render(<TrafficAdvisoryPage />);
    await screen.findByText("Urgent Road Closure: Bilang-Bilang St.");

    // Click Category "Construction"
    const constructionPill = screen.getByRole("button", { name: /Construction/i });
    fireEvent.click(constructionPill);

    // Click Category "All"
    const allPill = screen.getByRole("button", { name: "All" });
    fireEvent.click(allPill);

    // Toast alert for new advisory should NOT be shown on category switch
    expect(screen.queryByText(/New traffic advisory/i)).not.toBeInTheDocument();
  });

  test("toggling advisory alerts activates real-time alert preference", async () => {
    localStorage.clear();
    render(<TrafficAdvisoryPage />);

    const [notifyBtn] = await screen.findAllByRole("button", { name: /Advisory Alerts Active/i });
    expect(notifyBtn).toBeInTheDocument();

    // Toggle OFF
    fireEvent.click(notifyBtn);
    expect(await screen.findByText(/Advisory alerts turned off/i)).toBeInTheDocument();
    expect(localStorage.getItem("advisory_notifications")).toBe("false");

    // Toggle back ON
    fireEvent.click(notifyBtn);
    expect(await screen.findByText(/Advisory alerts turned on/i)).toBeInTheDocument();
    expect(localStorage.getItem("advisory_notifications")).toBe("true");
  });
});
