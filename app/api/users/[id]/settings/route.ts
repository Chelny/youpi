import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ProfanityFilter, UserSettings, WebsiteTheme } from "db/client";
import { handleApiError, handleUnauthorizedApiError } from "@/lib/api-error";
import { auth, Session } from "@/lib/auth";
import { getCurrentLocale } from "@/lib/locale";
import prisma from "@/lib/prisma";
import { UserSettingsManager } from "@/server/youpi/modules/user-settings/user-settings.manager";
import { dynamicActivate } from "@/translations/languages";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse>> {
  const { id } = await params;

  try {
    const userSettings: UserSettings = await UserSettingsManager.findById(id);

    return NextResponse.json(
      {
        success: true,
        data: userSettings,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse>> {
  const { id } = await params;

  let avatarId: string | undefined = undefined;
  let theme: WebsiteTheme | undefined = undefined;
  let profanityFilter: ProfanityFilter | undefined = undefined;

  try {
    const body = await request.json();
    avatarId = body.avatarId;
    theme = body.theme;
    profanityFilter = body.profanityFilter;
  } catch {
    // No body sent → seatNumber stays undefined
  }

  // @ts-ignore
  const session: Session | null = await auth.api.getSession({ headers: await headers() });
  if (!session) return handleUnauthorizedApiError();

  dynamicActivate(getCurrentLocale(request, session));

  try {
    const userSettings: UserSettings = await prisma.userSettings.update({
      where: { id },
      data: {
        avatarId,
        theme,
        profanityFilter,
      },
    });

    return NextResponse.json({ success: true, data: userSettings }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
