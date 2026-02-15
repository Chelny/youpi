import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError, handleUnauthorizedApiError } from "@/lib/api-error";
import { auth, Session } from "@/lib/auth";
import { getCurrentLocale } from "@/lib/locale";
import prisma from "@/lib/prisma";
import { ConversationPlainObject } from "@/server/youpi/modules/conversation/conversation.entity";
import { ConversationFactory } from "@/server/youpi/modules/conversation/conversation.factory";
import { dynamicActivate } from "@/translations/languages";
import { ConversationWithRelations, getConversationIncludes } from "@/types/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse>> {
  const { id } = await params;

  // @ts-ignore
  const session: Session | null = await auth.api.getSession({ headers: await headers() });
  if (!session) return handleUnauthorizedApiError();

  dynamicActivate(getCurrentLocale(request, session));

  try {
    const conversation: ConversationWithRelations = await prisma.conversation.findUniqueOrThrow({
      where: { id },
      include: getConversationIncludes(),
    });

    const data: ConversationPlainObject = ConversationFactory.convertToPlainObject(conversation);

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse>> {
  const { id } = await params;

  try {
    await prisma.conversation.delete({
      where: { id },
      include: getConversationIncludes(),
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
