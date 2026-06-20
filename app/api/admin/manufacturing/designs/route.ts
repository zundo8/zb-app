import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getManufacturingActorName } from "@/lib/manufacturing/admin-actor";
import { logMfgAudit } from "@/lib/manufacturing/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const collectionId = searchParams.get("collectionId") || undefined;
    const status = searchParams.get("status") || undefined;
    const assignedToId = searchParams.get("assignedToId") || undefined;
    const search = searchParams.get("search") || undefined;

    const where: any = {};
    if (collectionId) where.collectionId = collectionId;
    if (status && status !== "All") where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;
    if (search) {
      where.OR = [
        { styleCode: { contains: search, mode: "insensitive" } },
        { styleName: { contains: search, mode: "insensitive" } },
      ];
    }

    const designs = await prisma.mfgDesignAssignment.findMany({
      where,
      include: {
        collection: true,
        assignedTo: {
          select: { id: true, name: true, email: true, role: true }
        },
        assignedBy: {
          select: { id: true, name: true, email: true, role: true }
        },
        attachments: true,
        samples: {
          select: { id: true, status: true }
        }
      },
      orderBy: { submissionDeadline: "asc" }
    });

    return NextResponse.json(designs);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      collectionId, 
      styleName, 
      productCategory, 
      assignedToId, 
      assignedById, 
      submissionDeadline, 
      priority, 
      notes 
    } = body;

    if (!collectionId || !styleName || !productCategory) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Auto-generate styleCode
    const year = new Date().getFullYear().toString().slice(-2);
    const catClean = productCategory.replace(/[^a-zA-Z]/g, "").toUpperCase();
    const catCode = catClean.substring(0, 3).padEnd(3, "X");
    
    // Generate unique code with retries if collisions occur
    let styleCode = "";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (let attempts = 0; attempts < 10; attempts++) {
      let rand = "";
      for (let i = 0; i < 4; i++) {
        rand += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const candidate = `ZB${year}${catCode}${rand}`;
      const exists = await prisma.mfgDesignAssignment.findUnique({
        where: { styleCode: candidate }
      });
      if (!exists) {
        styleCode = candidate;
        break;
      }
    }

    if (!styleCode) {
      return NextResponse.json({ error: "Failed to generate unique style code" }, { status: 500 });
    }

    const design = await prisma.mfgDesignAssignment.create({
      data: {
        collectionId,
        styleCode,
        styleName,
        productCategory,
        assignedToId: assignedToId || null,
        assignedById: assignedById || null,
        submissionDeadline: submissionDeadline ? new Date(submissionDeadline) : null,
        priority: priority || "MEDIUM",
        notes: notes || null,
        status: "Not Started"
      },
      include: {
        collection: true,
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    const actor = await getManufacturingActorName();
    await logMfgAudit("MfgDesignAssignment", design.id, "CREATE", actor, { styleCode, styleName });

    return NextResponse.json(design);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
