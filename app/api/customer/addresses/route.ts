import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const whereClause: any = { OR: [] };
    if (session.user.email) {
      whereClause.OR.push({ email: session.user.email });
    }
    const userId = (session.user as any).id;
    if (userId) {
      whereClause.OR.push({ id: userId });
    }

    if (whereClause.OR.length === 0) {
      return NextResponse.json({ error: "No valid user identifier" }, { status: 400 });
    }

    const customer = await prisma.customer.findFirst({
      where: whereClause,
      include: {
        addresses: {
          orderBy: { updatedAt: "desc" }
        }
      }
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ addresses: customer.addresses });
  } catch (error: any) {
    console.error("Fetch Addresses Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, email, address1, address2, city, state, zip, country, isDefault, lat, lng, placeId } = body;

    if (!address1 || !city || !state || !zip) {
      return NextResponse.json({ error: "Missing required address fields" }, { status: 400 });
    }

    const whereClause: any = { OR: [] };
    if (session.user.email) {
      whereClause.OR.push({ email: session.user.email });
    }
    const userId = (session.user as any).id;
    if (userId) {
      whereClause.OR.push({ id: userId });
    }

    if (whereClause.OR.length === 0) {
      return NextResponse.json({ error: "No valid user identifier" }, { status: 400 });
    }

    const customer = await prisma.customer.findFirst({
      where: whereClause
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (name && name !== customer.name) {
      updateData.name = name;
    }
    if (email && email !== customer.email) {
      updateData.email = email;
    }
    if (phone && phone !== customer.phone) {
      updateData.phone = phone;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: updateData
      });
      Object.assign(customer, updateData);
    }

    if (isDefault) {
      await prisma.address.updateMany({
        where: { customerId: customer.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const newAddress = await prisma.address.create({
      data: {
        customerId: customer.id,
        name: name || customer.name || "",
        phone: phone || customer.phone || "",
        email: email || customer.email || "",
        address1,
        address2,
        city,
        state,
        zip,
        country: country || "India",
        isDefault: isDefault || false,
        lat: lat != null ? parseFloat(lat) : null,
        lng: lng != null ? parseFloat(lng) : null,
        placeId: placeId || null,
      }
    });

    // If it's default or the only address, update customer's defaultAddress
    const addressesCount = await prisma.address.count({ where: { customerId: customer.id } });
    if (isDefault || addressesCount === 1) {
      if (!isDefault) {
        await prisma.address.update({
          where: { id: newAddress.id },
          data: { isDefault: true }
        });
        newAddress.isDefault = true;
      }
      
      const legacyAddressJson = {
        name: newAddress.name,
        email: newAddress.email,
        phone: newAddress.phone,
        street: newAddress.address2 ? `${newAddress.address1}, ${newAddress.address2}` : newAddress.address1,
        city: newAddress.city,
        state: newAddress.state,
        zip: newAddress.zip,
        country: newAddress.country,
      };

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          defaultAddress: JSON.stringify(legacyAddressJson)
        }
      });
    }

    return NextResponse.json({ success: true, address: newAddress });
  } catch (error: any) {
    console.error("Create Address Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, phone, email, address1, address2, city, state, zip, country, isDefault, lat, lng, placeId } = body;

    if (!id) {
      return NextResponse.json({ error: "Address ID is required" }, { status: 400 });
    }

    const whereClause: any = { OR: [] };
    if (session.user.email) {
      whereClause.OR.push({ email: session.user.email });
    }
    const userId = (session.user as any).id;
    if (userId) {
      whereClause.OR.push({ id: userId });
    }

    const customer = await prisma.customer.findFirst({
      where: whereClause
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (name && name !== customer.name) {
      updateData.name = name;
    }
    if (email && email !== customer.email) {
      updateData.email = email;
    }
    if (phone && phone !== customer.phone) {
      updateData.phone = phone;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: updateData
      });
      Object.assign(customer, updateData);
    }

    // Verify address belongs to customer
    const existingAddress = await prisma.address.findFirst({
      where: { id, customerId: customer.id }
    });

    if (!existingAddress) {
      return NextResponse.json({ error: "Address not found or access denied" }, { status: 404 });
    }

    if (isDefault) {
      await prisma.address.updateMany({
        where: { customerId: customer.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updatedAddress = await prisma.address.update({
      where: { id },
      data: {
        name,
        phone,
        email,
        address1,
        address2,
        city,
        state,
        zip,
        country,
        isDefault,
        lat: lat != null ? parseFloat(lat) : undefined,
        lng: lng != null ? parseFloat(lng) : undefined,
        placeId: placeId !== undefined ? (placeId || null) : undefined,
      }
    });

    if (isDefault) {
      const legacyAddressJson = {
        name: updatedAddress.name,
        email: updatedAddress.email,
        phone: updatedAddress.phone,
        street: updatedAddress.address2 ? `${updatedAddress.address1}, ${updatedAddress.address2}` : updatedAddress.address1,
        city: updatedAddress.city,
        state: updatedAddress.state,
        zip: updatedAddress.zip,
        country: updatedAddress.country,
      };

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          defaultAddress: JSON.stringify(legacyAddressJson)
        }
      });
    }

    return NextResponse.json({ success: true, address: updatedAddress });
  } catch (error: any) {
    console.error("Update Address Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Address ID is required" }, { status: 400 });
    }

    const whereClause: any = { OR: [] };
    if (session.user.email) {
      whereClause.OR.push({ email: session.user.email });
    }
    const userId = (session.user as any).id;
    if (userId) {
      whereClause.OR.push({ id: userId });
    }

    const customer = await prisma.customer.findFirst({
      where: whereClause
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const existingAddress = await prisma.address.findFirst({
      where: { id, customerId: customer.id }
    });

    if (!existingAddress) {
      return NextResponse.json({ error: "Address not found or access denied" }, { status: 404 });
    }

    await prisma.address.delete({
      where: { id }
    });

    // If we deleted the default address, set another address as default
    if (existingAddress.isDefault) {
      const anotherAddress = await prisma.address.findFirst({
        where: { customerId: customer.id }
      });
      if (anotherAddress) {
        const updated = await prisma.address.update({
          where: { id: anotherAddress.id },
          data: { isDefault: true }
        });
        
        const legacyAddressJson = {
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
          street: updated.address2 ? `${updated.address1}, ${updated.address2}` : updated.address1,
          city: updated.city,
          state: updated.state,
          zip: updated.zip,
          country: updated.country,
        };

        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            defaultAddress: JSON.stringify(legacyAddressJson)
          }
        });
      } else {
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            defaultAddress: null
          }
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete Address Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
