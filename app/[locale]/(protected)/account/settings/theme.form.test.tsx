import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WebsiteTheme } from "db/enums";
import { Mock, vi } from "vitest";
import { ThemeForm } from "@/app/[locale]/(protected)/account/settings/theme.form";
import { ModalProvider } from "@/context/ModalContext";
import { mockFetchResponse } from "@/test/mocks/fetch";
import { mockSession } from "@/test/mocks/session";

interface MockSettingsResponse {
  success: boolean
  data: { theme: WebsiteTheme }
}

const mockMutate: Mock = vi.fn();
const mockUpdateSettings: Mock = vi.fn();

let mockSettingsResponse: MockSettingsResponse = {
  data: { theme: WebsiteTheme.SYSTEM },
  success: false,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockError: any = null;
let mockIsMutating: boolean = false;

vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({
    theme: "system",
    setTheme: vi.fn(),
  })),
}));

vi.mock("@/hooks/useUserSettings", () => ({
  useUserSettings: vi.fn(() => ({
    settingsResponse: mockSettingsResponse,
    isLoading: false,
    isMutating: mockIsMutating,
    error: mockError,
    mutate: mockMutate,
    updateSettings: mockUpdateSettings,
  })),
}));

describe("Theme Form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsResponse = {
      data: { theme: WebsiteTheme.SYSTEM },
      success: false,
    };
    mockError = null;
    mockIsMutating = false;
  });

  it("should render the form with all elements", () => {
    render(
      <ModalProvider>
        <ThemeForm session={mockSession} />
      </ModalProvider>,
    );

    expect(screen.getByTestId("settings_form_theme")).toBeInTheDocument();
    expect(screen.getByTestId("settings_select_theme")).toBeInTheDocument();
    expect(screen.queryByText("The theme has been updated!")).not.toBeInTheDocument();
  });

  it("should submit the form successfully", async () => {
    const mockResponse: ApiResponse = {
      success: true,
      message: "The theme have been updated!",
    };

    mockUpdateSettings.mockResolvedValue(mockFetchResponse(mockResponse));

    render(
      <ModalProvider>
        <ThemeForm session={mockSession} />
      </ModalProvider>,
    );

    fireEvent.click(screen.getByTestId("settings_select_theme"));
    fireEvent.click(screen.getByText(/Light/i));

    await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalledTimes(1));

    expect(mockUpdateSettings).toHaveBeenCalledWith({
      theme: WebsiteTheme.LIGHT,
    });

    await waitFor(() => {
      expect(screen.getByText("The theme has been updated!")).toBeInTheDocument();
    });
  });

  it("should display an error message when the API call fails", async () => {
    const errorMessage: string = "Failed to update theme";

    mockUpdateSettings.mockImplementation(() => {
      mockError = { message: errorMessage };
      return Promise.reject(new Error(errorMessage));
    });

    render(
      <ModalProvider>
        <ThemeForm session={mockSession} />
      </ModalProvider>,
    );

    fireEvent.click(screen.getByTestId("settings_select_theme"));
    fireEvent.click(screen.getByText(/Light/i));

    await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalledTimes(1));

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    expect(screen.queryByText("The theme has been updated!")).not.toBeInTheDocument();
  });
});
