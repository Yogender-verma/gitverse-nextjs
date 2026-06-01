import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import { broadcastAnnotationEvent } from "../sync/route";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const id = params.id;
    const body = await request.json();
    const { content, annotationType, positionX, positionY } = body;

    const existing = await prisma.mapAnnotation.findUnique({
      where: { id },
      include: { repository: true }
    });

    if (!existing) {
      return apiError("Annotation not found", 404);
    }

    // Only author or repo owner can edit
    if (existing.authorId !== user.userId && existing.repository.userId !== user.userId) {
      return apiError("Forbidden", 403);
    }

    const updated = await prisma.mapAnnotation.update({
      where: { id },
      data: {
        content: content !== undefined ? content : existing.content,
        annotationType: annotationType !== undefined ? annotationType : existing.annotationType,
        positionX: positionX !== undefined ? positionX : existing.positionX,
        positionY: positionY !== undefined ? positionY : existing.positionY,
      },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      }
    });

    await prisma.annotationActivity.create({
      data: {
        annotationId: updated.id,
        userId: user.userId,
        action: 'updated',
      }
    });

    broadcastAnnotationEvent(updated.repositoryId.toString(), {
      type: 'updated',
      annotation: updated
    });

    return apiSuccess({ annotation: updated });
  } catch (error: any) {
    return apiError("Failed to update annotation", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const id = params.id;

    const existing = await prisma.mapAnnotation.findUnique({
      where: { id },
      include: { repository: true }
    });

    if (!existing) {
      return apiError("Annotation not found", 404);
    }

    if (existing.authorId !== user.userId && existing.repository.userId !== user.userId) {
      return apiError("Forbidden", 403);
    }

    // Capture repositoryId before deletion for broadcasting
    const repositoryId = existing.repositoryId;

    await prisma.annotationActivity.create({
      data: {
        annotationId: id,
        userId: user.userId,
        action: 'deleted',
      }
    });

    await prisma.mapAnnotation.delete({ where: { id } });

    broadcastAnnotationEvent(repositoryId.toString(), {
      type: 'deleted',
      annotationId: id
    });

    return apiSuccess({ success: true });
  } catch (error: any) {
    return apiError("Failed to delete annotation", 500);
  }
}
