import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import { broadcastAnnotationEvent } from "./sync/route";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get("repositoryId");

    if (!repositoryId) {
      return apiError("repositoryId is required", 400);
    }

    const annotations = await prisma.mapAnnotation.findMany({
      where: {
        repositoryId: parseInt(repositoryId),
      },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    return apiSuccess({ annotations });
  } catch (error: any) {
    return apiError("Failed to fetch annotations", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    
    const { repositoryId, targetType, targetId, content, annotationType, positionX, positionY } = body;

    if (!repositoryId || !targetType || !targetId || !content || !annotationType) {
      return apiError("Missing required fields", 400);
    }

    // Verify user has access to repo (simple check, assume requireAuth is sufficient or add repo ownership check)
    const repo = await prisma.repository.findFirst({
      where: {
        id: parseInt(repositoryId),
        userId: user.userId, // Or organization access check if applicable
      }
    });

    if (!repo) {
      return apiError("Repository not found or access denied", 403);
    }

    const annotation = await prisma.mapAnnotation.create({
      data: {
        repositoryId: parseInt(repositoryId),
        authorId: user.userId,
        targetType,
        targetId,
        content,
        annotationType,
        positionX,
        positionY,
      },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      }
    });

    await prisma.annotationActivity.create({
      data: {
        annotationId: annotation.id,
        userId: user.userId,
        action: 'created',
      }
    });

    // Broadcast
    broadcastAnnotationEvent(annotation.repositoryId.toString(), {
      type: 'created',
      annotation
    });

    return apiSuccess({ annotation }, 201);
  } catch (error: any) {
    console.error("Failed to create annotation", error);
    return apiError("Failed to create annotation", 500);
  }
}
