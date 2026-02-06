import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { LanguageForm } from "@/app/[locale]/(protected)/account/settings/language.form";
import { APP_STORAGE_KEYS } from "@/constants/app";
import { ModalProvider } from "@/context/ModalContext";
import { mockFetch, mockFetchResponse } from "@/test/mocks/fetch";
import { mockLocalStorage } from "@/test/mocks/local-storage";
import { mockSession } from "@/test/mocks/session";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/en/account/settings"),
}));

describe("Language Form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
  });

  it("should render the form with all elements", () => {
    render(
      <ModalProvider>
        <LanguageForm session={mockSession} />
      </ModalProvider>,
    );

    expect(screen.getByTestId("settings_form_language")).toBeInTheDocument();
    expect(screen.getByTestId("settings_select_language")).toBeInTheDocument();
  });

  it("should submit the form successfully", async () => {
    const mockResponse: ApiResponse = {
      success: true,
      message: "The language have been updated!",
    };

    mockFetch.mockResolvedValue(mockFetchResponse(mockResponse));

    render(
      <ModalProvider>
        <LanguageForm session={mockSession} />
      </ModalProvider>,
    );

    fireEvent.click(screen.getByTestId("settings_select_language"));
    fireEvent.click(screen.getByRole("option", { name: /French/i }));

    expect(mockFetch).toHaveBeenCalledWith(`/api/users/${mockSession.user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ language: "fr" }),
    });

    await waitFor(() => {
      const savedState: ApiResponse = JSON.parse(localStorage.getItem(APP_STORAGE_KEYS.SETTINGS_FORM_STATE) as string);

      expect(savedState.success).toBe(true);
      expect(savedState.message).toBe("The language have been updated!");
    });
  });

  it("should display an error message when the API call fails", async () => {
    const mockResponse: ApiResponse = {
      success: false,
      message: "Failed to update language",
    };

    mockFetch.mockResolvedValue(mockFetchResponse(mockResponse));

    render(
      <ModalProvider>
        <LanguageForm session={mockSession} />
      </ModalProvider>,
    );

    fireEvent.click(screen.getByTestId("settings_select_language"));
    fireEvent.click(screen.getByRole("option", { name: /French/i }));

    await waitFor(() => {
      const savedState: ApiResponse = JSON.parse(localStorage.getItem(APP_STORAGE_KEYS.SETTINGS_FORM_STATE) as string);

      expect(savedState.success).toBe(false);
      expect(savedState.message).toBe("Failed to update language");
    });
  });
});
