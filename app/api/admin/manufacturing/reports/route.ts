import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "daily";

    const now = new Date();

        if (type === "daily") {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const newDesignsToday = await prisma.mfgDesignAssignment.count({
        where: { createdAt: { gte: todayStart } }
      });

      const completedTasksToday = await prisma.mfgTask.count({
        where: {
          completedAt: { gte: todayStart },
          status: "COMPLETED"
        }
      });

      const samplesSubmittedToday = await prisma.mfgSample.count({
        where: { submittedAt: { gte: todayStart } }
      });

      const overdueDesigns = await prisma.mfgDesignAssignment.count({
        where: {
          submissionDeadline: { lt: now },
          NOT: {
            status: { in: ["Approved", "Rejected"] }
          }
        }
      });

      const totalActiveDesigns = await prisma.mfgDesignAssignment.count({
        where: {
          status: { in: ["Not Started", "In Progress", "Submitted"] }
        }
      });

      const samplesAwaitingApproval = await prisma.mfgSample.count({
        where: {
          status: "Pending Review"
        }
      });

      const activeProductionBatches = await prisma.mfgProductionBatch.count({
        where: {
          NOT: {
            currentStage: { in: ["QC_PASSED", "REJECTED_REWORK"] }
          }
        }
      });

      const fabricSkusInStock = await prisma.mfgFabric.count({
        where: {
          status: "ACTIVE"
        }
      });

      const totalVendors = await prisma.mfgVendor.count();

      const tasksPending = await prisma.mfgTask.count({
        where: {
          status: "PENDING"
        }
      });

      const tasksOverdue = await prisma.mfgTask.count({
        where: {
          status: "PENDING",
          dueDate: {
            lt: now
          }
        }
      });

      return NextResponse.json({
        newDesignsToday,
        completedTasksToday,
        samplesSubmittedToday,
        overdueDesigns,
        totalActiveDesigns,
        samplesAwaitingApproval,
        activeProductionBatches,
        fabricSkusInStock,
        totalVendors,
        tasksPending,
        tasksOverdue
      });
    }

    if (type === "weekly") {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // designsPerUser
      const weeklyDesigns = await prisma.mfgDesignAssignment.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: {
          assignedToId: true,
          assignedTo: { select: { name: true } }
        }
      });
      const designsMap: Record<string, { count: number; name: string }> = {};
      for (const d of weeklyDesigns) {
        const id = d.assignedToId || "unassigned";
        const name = d.assignedTo?.name || "Unassigned";
        if (!designsMap[id]) {
          designsMap[id] = { count: 0, name };
        }
        designsMap[id].count++;
      }
      const designsPerUser = Object.values(designsMap);

      // sampleApprovalBreakdown
      const weeklySamples = await prisma.mfgSample.findMany({
        where: { submittedAt: { gte: sevenDaysAgo } },
        select: { status: true }
      });
      const sampleApprovalBreakdown = { approved: 0, rejected: 0, revisionRequired: 0, pending: 0 };
      for (const s of weeklySamples) {
        if (s.status === "Approved") sampleApprovalBreakdown.approved++;
        else if (s.status === "Rejected") sampleApprovalBreakdown.rejected++;
        else if (s.status === "Revision Required") sampleApprovalBreakdown.revisionRequired++;
        else if (s.status === "Pending Review") sampleApprovalBreakdown.pending++;
      }

      // productionStageDistribution
      const activeBatches = await prisma.mfgProductionBatch.findMany({
        select: { currentStage: true }
      });
      const stageMap: Record<string, number> = {};
      for (const b of activeBatches) {
        stageMap[b.currentStage] = (stageMap[b.currentStage] || 0) + 1;
      }
      const productionStageDistribution = Object.entries(stageMap).map(([stage, count]) => ({
        stage,
        count
      }));

      // delayedTasks
      const delayedTasks = await prisma.mfgDesignAssignment.findMany({
        where: {
          submissionDeadline: { lt: now },
          NOT: {
            status: { in: ["Approved", "Rejected"] }
          }
        },
        include: {
          assignedTo: { select: { name: true } }
        }
      });

      return NextResponse.json({
        designsPerUser,
        sampleApprovalBreakdown,
        productionStageDistribution,
        delayedTasks: delayedTasks.map((t) => ({
          styleCode: t.styleCode,
          styleName: t.styleName,
          deadline: t.submissionDeadline,
          assignedToName: t.assignedTo?.name || "Unassigned"
        }))
      });
    }

    if (type === "monthly") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // designOutputByWeek
      const monthlyDesigns = await prisma.mfgDesignAssignment.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true }
      });
      const weeks = [
        { name: "Week 1", count: 0 },
        { name: "Week 2", count: 0 },
        { name: "Week 3", count: 0 },
        { name: "Week 4", count: 0 }
      ];
      for (const d of monthlyDesigns) {
        const diffDays = Math.floor((now.getTime() - d.createdAt.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays <= 7) weeks[3].count++;
        else if (diffDays <= 14) weeks[2].count++;
        else if (diffDays <= 21) weeks[1].count++;
        else weeks[0].count++;
      }

      // sampleApprovalRate
      const monthlySamples = await prisma.mfgSample.findMany({
        where: { reviewedAt: { gte: thirtyDaysAgo } },
        select: { status: true }
      });
      let approved = 0;
      let reviewedCount = 0;
      for (const s of monthlySamples) {
        if (s.status === "Approved") {
          approved++;
          reviewedCount++;
        } else if (s.status === "Rejected" || s.status === "Revision Required") {
          reviewedCount++;
        }
      }
      const sampleApprovalRate = reviewedCount > 0 ? Math.round((approved / reviewedCount) * 100) : 100;

      // topPerformers
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          mfgPerformanceEvents: {
            where: { createdAt: { gte: thirtyDaysAgo } },
            select: { scoreDelta: true }
          }
        }
      });
      const topPerformers = users
        .map((u) => ({
          name: u.name || u.email,
          scoreDelta: u.mfgPerformanceEvents.reduce((acc, c) => acc + c.scoreDelta, 0)
        }))
        .filter((u) => u.scoreDelta > 0)
        .sort((a, b) => b.scoreDelta - a.scoreDelta)
        .slice(0, 5);

      // vendorUsage
      const monthlyVendorSamples = await prisma.mfgSample.findMany({
        where: {
          submittedAt: { gte: thirtyDaysAgo },
          vendorId: { not: null }
        },
        include: {
          vendor: { select: { name: true } }
        }
      });
      const vendorMap: Record<string, { name: string; count: number }> = {};
      for (const s of monthlyVendorSamples) {
        if (s.vendorId) {
          if (!vendorMap[s.vendorId]) {
            vendorMap[s.vendorId] = { name: s.vendor?.name || "Unknown", count: 0 };
          }
          vendorMap[s.vendorId].count++;
        }
      }
      const vendorUsage = Object.values(vendorMap);

      return NextResponse.json({
        designOutputByWeek: weeks,
        sampleApprovalRate,
        topPerformers,
        vendorUsage
      });
    }

    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
