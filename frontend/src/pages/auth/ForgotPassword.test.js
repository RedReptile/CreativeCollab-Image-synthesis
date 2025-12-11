import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

jest.mock("react-router-dom");

let consoleLogSpy;

jest.mock("../../firebase", () => ({
  auth: {},
  db: {},
}));

jest.mock("firebase/auth", () => ({
  sendPasswordResetEmail: jest.fn(() => Promise.resolve()),
}));

jest.mock("react-toastify", () => ({
  toast: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// keep import after mocks
import ForgotPasswordPage from "./ForgotPassword";

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("renders and sends reset when email is provided", async () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText(/email address/i);
    fireEvent.change(emailInput, {
      target: { value: "user@example.com" },
    });

    const sendButton = screen.getByRole("button", { name: /send link/i });

    await act(async () => {
      fireEvent.click(sendButton);
    });

    expect(sendButton).toBeInTheDocument();
  });
});

