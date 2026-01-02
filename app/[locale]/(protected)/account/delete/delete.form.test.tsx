import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Mock } from "vitest";
import { DeleteAccountForm } from "@/app/[locale]/(protected)/account/delete/delete.form";
import { mockUseRouter } from "@/test/mocks/router";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => mockUseRouter),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    deleteUser: vi.fn(),
  },
}));

describe("Delete Account Form", () => {
  it("should render the form with all elements", () => {
    render(<DeleteAccountForm />);

    expect(screen.getByTestId("delete-account_input-email_email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm Deletion/i })).toBeInTheDocument();
  });

  it("should correctly mark form fields as required", () => {
    render(<DeleteAccountForm />);

    expect(screen.getByTestId("delete-account_input-email_email")).toHaveAttribute("required");
  });

  it("should display error messages when the form is submitted with empty fields", () => {
    render(<DeleteAccountForm />);

    fireEvent.click(screen.getByRole("button", { name: /Confirm Deletion/i }));

    expect(screen.getByText(/The email is invalid/i)).toBeInTheDocument();
  });

  it("should disable the submit button during form submission and show a success message on successful submission", async () => {
    const { authClient } = await import("@/lib/auth-client");
    // @ts-ignore
    const mockResetPassword: Mock = authClient.deleteUser as Mock;

    mockResetPassword.mockImplementation(async (_, callbacks) => {
      callbacks.onRequest();
      await new Promise((resolve) => setTimeout(resolve, 100));
      callbacks.onSuccess();
    });

    render(<DeleteAccountForm />);

    fireEvent.input(screen.getByTestId("delete-account_input-email_email"), {
      target: { value: "john.doe@example.com" },
    });

    const submitButton: HTMLButtonElement = screen.getByRole("button", { name: /Confirm Deletion/i });
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText(/Your account deletion request has been accepted/i)).toBeInTheDocument();
    });
  });
});
