import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { extractVariables } from '@/lib/email-templates';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const data = await req.json();

    const updatedTemplate = await prisma.emailTemplate.update({
      where: { id },
      data: {
        name: data.name,
        category: data.category,
        subject: data.subject,
        htmlBody: data.htmlBody,
        variables: data.variables || extractVariables(data.htmlBody || ''),
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    return NextResponse.json({ success: true, template: updatedTemplate });
  } catch (error: any) {
    console.error('Update template error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    await prisma.emailTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete template error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
