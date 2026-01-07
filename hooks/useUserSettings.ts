import { WebsiteTheme } from "db/enums";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { fetcher } from "@/lib/fetcher";

type SettingsDTO = {
  avatarId?: string
  theme?: WebsiteTheme
};

export function useUserSettings(userId?: string) {
  const key: string | null = userId ? `/api/users/${userId}/settings` : null;

  const swr = useSWR<ApiResponse<SettingsDTO>>(key, fetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const mutation = useSWRMutation(
    key,
    (url: string, { arg }: { arg: SettingsDTO }) =>
      fetcher<SettingsDTO>(url, { method: "PATCH", body: JSON.stringify(arg) }),
    { revalidate: false },
  );

  const updateSettings = async (patch: SettingsDTO): Promise<ApiResponse<SettingsDTO>> => {
    if (!key) throw new Error("Missing userId");

    await swr.mutate(
      (current: ApiResponse<SettingsDTO> | undefined) => {
        const currentData: SettingsDTO = current?.data ?? ({} as SettingsDTO);
        return { ...(current ?? { success: true }), data: { ...currentData, ...patch } };
      },
      { revalidate: false },
    );

    const response: ApiResponse<SettingsDTO> = await mutation.trigger(patch);

    if (response?.data) {
      await swr.mutate(response, { revalidate: false });
    }

    return response;
  };

  return {
    settingsResponse: swr.data,
    isLoading: swr.isLoading,
    error: swr.error,
    mutate: swr.mutate,
    updateSettings,
    isMutating: mutation.isMutating,
  };
}
