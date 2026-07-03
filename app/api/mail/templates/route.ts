import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: Return all saved email templates
export async function GET(request: NextRequest) {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Map htmlBody column to html to match Module 4 requirements
    const formattedTemplates = templates.map((t: any) => ({
      id: t.id,
      name: t.name,
      subject: t.subject,
      html: t.htmlBody,
      category: t.category,
      isActive: t.isActive,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return NextResponse.json({ success: true, templates: formattedTemplates }, { status: 200 });
  } catch (error: any) {
    console.error('[Templates GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST: Save a new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, subject, html, category } = body;

    if (!name || !subject || !html) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, subject, and html are required.' },
        { status: 400 }
      );
    }

    const newTemplate = await prisma.emailTemplate.create({
      data: {
        name,
        subject,
        htmlBody: html,
        category: category || 'custom',
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Template created successfully',
        template: {
          id: newTemplate.id,
          name: newTemplate.name,
          subject: newTemplate.subject,
          html: newTemplate.htmlBody,
          createdAt: newTemplate.createdAt,
          updatedAt: newTemplate.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[Templates POST Error]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to create template' }, { status: 500 });
  }
}

// PUT: Update existing template by id (passed in body)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, subject, html, category, isActive } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Template ID is required.' }, { status: 400 });
    }

    const updatedTemplate = await prisma.emailTemplate.update({
      where: { id },
      data: {
        name,
        subject,
        htmlBody: html,
        category,
        isActive,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Template updated successfully',
        template: {
          id: updatedTemplate.id,
          name: updatedTemplate.name,
          subject: updatedTemplate.subject,
          html: updatedTemplate.htmlBody,
          createdAt: updatedTemplate.createdAt,
          updatedAt: updatedTemplate.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Templates PUT Error]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to update template' }, { status: 500 });
  }
}

// DELETE: Delete template by id (passed in query parameters)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Template ID is required in query parameter (?id=...).' }, { status: 400 });
    }

    await prisma.emailTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Template deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('[Templates DELETE Error]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to delete template' }, { status: 500 });
  }
}
