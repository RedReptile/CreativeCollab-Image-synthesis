import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";

jest.mock("@stripe/react-stripe-js/checkout", () => ({
  PaymentElement: () => <div data-testid="payment-element" />,
  useCheckout: () => ({
    type: "ready",
    checkout: {
      total: { total: { amount: "10.00" } },
      updateEmail: jest.fn(() => ({ type: "success" })),
      confirm: jest.fn(() => ({ type: "success" })),
    },
  }),
}));

import CheckoutForm from "./CheckoutForm";

describe("CheckoutForm", () => {
  it("renders payment element and handles submit", async () => {
    render(<CheckoutForm />);

    expect(screen.getByTestId("payment-element")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
  });
});

