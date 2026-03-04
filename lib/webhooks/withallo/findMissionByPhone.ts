/**
 * Find mission by phone number.
 * Normalizes phone (strip spaces, remove +, last 9 digits for France),
 * then searches Contact and Company tables.
 */
import { prisma } from "@/lib/prisma";

export interface MissionMatch {
  missionId: string;
  contactId?: string | null;
  companyId?: string | null;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\s/g, "").replace(/^00/, "+").replace(/\D/g, "");
}

function last9Digits(phone: string): string {
  const digits = normalizePhone(phone);
  return digits.slice(-9);
}

export async function findMissionByPhone(phone: string): Promise<MissionMatch | null> {
  if (!phone?.trim()) return null;

  const last9 = last9Digits(phone);
  if (!last9) return null;

  const contact = await prisma.contact.findFirst({
    where: {
      OR: [
        { phone: { not: null }, phone: { contains: last9 } },
        { phone: phone.trim() },
      ],
    },
    select: {
      id: true,
      companyId: true,
      company: {
        select: {
          id: true,
          list: {
            select: {
              missionId: true,
            },
          },
        },
      },
    },
  });

  if (contact?.company?.list?.missionId) {
    return {
      missionId: contact.company.list.missionId,
      contactId: contact.id,
      companyId: contact.companyId,
    };
  }

  const company = await prisma.company.findFirst({
    where: {
      OR: [
        { phone: { not: null }, phone: { contains: last9 } },
        { phone: phone.trim() },
      ],
    },
    select: {
      id: true,
      list: {
        select: {
          missionId: true,
        },
      },
    },
  });

  if (company?.list?.missionId) {
    return {
      missionId: company.list.missionId,
      contactId: null,
      companyId: company.id,
    };
  }

  return null;
}
