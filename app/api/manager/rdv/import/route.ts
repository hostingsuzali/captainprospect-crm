import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actionService } from "@/lib/services/ActionService";
import { requireRole, withErrorHandler } from "@/lib/api-utils";

// ============================================
// RDV IMPORT – Create MEETING_BOOKED actions from CSV
// ============================================
// FormData: file (CSV), missionId, listId (optional), mappings (JSON).
// Mappings: { dateColumn, contactEmailColumn?, companyNameColumn?, meetingTypeColumn?, meetingCategoryColumn?, noteColumn?, meetingAddressColumn?, meetingJoinUrlColumn?, meetingPhoneColumn? }
// Only creates RDV actions; contact/company must exist in mission lists.
// ============================================

function parseCSVLine(line: string, delimiter: string = ","): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function detectDelimiter(firstLine: string): string {
    const delimiters = [",", ";", "\t", "|"];
    let maxCount = 0;
    let detected = ",";
    for (const d of delimiters) {
        const count = (firstLine.match(new RegExp(`\\${d}`, "g")) || []).length;
        if (count > maxCount) {
            maxCount = count;
            detected = d;
        }
    }
    return detected;
}

function parseCsvDate(raw: string): Date | undefined {
    const value = raw.trim();
    if (!value) return undefined;
    const frMatch = value.match(
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/
    );
    if (frMatch) {
        const day = parseInt(frMatch[1], 10);
        const month = parseInt(frMatch[2], 10);
        let year = parseInt(frMatch[3], 10);
        const hours = frMatch[4] ? parseInt(frMatch[4], 10) : 0;
        const minutes = frMatch[5] ? parseInt(frMatch[5], 10) : 0;
        if (year < 100) year = 2000 + year;
        if (
            Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year) ||
            day < 1 || day > 31 || month < 1 || month > 12
        ) return undefined;
        const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
        return Number.isNaN(d.getTime()) ? undefined : d;
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

const MEETING_TYPES = ["VISIO", "PHYSIQUE", "TELEPHONIQUE"] as const;
const MEETING_CATEGORIES = ["EXPLORATOIRE", "BESOIN"] as const;

export interface RdvImportMappings {
    dateColumn: string;
    contactEmailColumn?: string;
    companyNameColumn?: string;
    meetingTypeColumn?: string;
    meetingCategoryColumn?: string;
    noteColumn?: string;
    meetingAddressColumn?: string;
    meetingJoinUrlColumn?: string;
    meetingPhoneColumn?: string;
}

type MissingEntityHandling = "skip" | "create_company" | "create_contact_and_company";

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["MANAGER"], request);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const missionId = (formData.get("missionId") as string)?.trim();
    const listIdParam = (formData.get("listId") as string)?.trim() || null;
    const mappingsStr = (formData.get("mappings") as string)?.trim();
    const missingEntityHandlingRaw = ((formData.get("missingEntityHandling") as string) || "skip").trim();
    const missingEntityHandling: MissingEntityHandling =
        missingEntityHandlingRaw === "create_company" || missingEntityHandlingRaw === "create_contact_and_company"
            ? missingEntityHandlingRaw
            : "skip";

    if (!file || !missionId || !mappingsStr) {
        return NextResponse.json(
            { success: false, error: "Fichier, mission et mappings requis" },
            { status: 400 }
        );
    }

    let mappings: RdvImportMappings;
    try {
        mappings = JSON.parse(mappingsStr) as RdvImportMappings;
    } catch {
        return NextResponse.json(
            { success: false, error: "mappings invalide (JSON attendu)" },
            { status: 400 }
        );
    }
    if (!mappings.dateColumn) {
        return NextResponse.json(
            { success: false, error: "La colonne date est obligatoire" },
            { status: 400 }
        );
    }
    if (!mappings.contactEmailColumn && !mappings.companyNameColumn) {
        return NextResponse.json(
            { success: false, error: "Indiquez une colonne email contact ou nom de société" },
            { status: 400 }
        );
    }

    const mission = await prisma.mission.findUnique({
        where: { id: missionId },
        select: {
            id: true,
            channel: true,
            campaigns: { where: { isActive: true }, take: 1, orderBy: { createdAt: "asc" }, select: { id: true } },
            lists: { select: { id: true } },
        },
    });
    if (!mission) {
        return NextResponse.json({ success: false, error: "Mission non trouvée" }, { status: 404 });
    }
    const campaignId = mission.campaigns[0]?.id;
    if (!campaignId) {
        return NextResponse.json(
            { success: false, error: "Aucune campagne active pour cette mission" },
            { status: 400 }
        );
    }
    const channel = (mission.channel as "CALL" | "EMAIL" | "LINKEDIN") || "CALL";
    const listIds = listIdParam
        ? [listIdParam]
        : mission.lists.map((l) => l.id);
    if (listIds.length === 0) {
        return NextResponse.json(
            { success: false, error: "La mission n'a aucune liste (ou liste fournie invalide)" },
            { status: 400 }
        );
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
        return NextResponse.json(
            { success: false, error: "Le fichier doit contenir une ligne d'en-tête et au moins une ligne de données" },
            { status: 400 }
        );
    }
    const delimiter = detectDelimiter(lines[0]);
    const headers = parseCSVLine(lines[0], delimiter).map((h) => h.replace(/^"|"$/g, ""));

    const getVal = (row: Record<string, string>, col: string | undefined): string =>
        (col && row[col] !== undefined ? row[col] : "").trim();

    let created = 0;
    const errors: { row: number; message: string }[] = [];
    let skippedInvalidDate = 0;
    let skippedMissingEntity = 0;
    let createdCompanies = 0;
    let createdContacts = 0;
    const fallbackListId = listIdParam || mission.lists[0]?.id || null;

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], delimiter).map((v) => v.replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, j) => {
            row[h] = values[j] ?? "";
        });
        const rowNum = i + 1;

        const dateRaw = getVal(row, mappings.dateColumn);
        const callbackDate = dateRaw ? parseCsvDate(dateRaw) : undefined;
        if (!callbackDate) {
            skippedInvalidDate++;
            continue;
        }

        const contactEmail = mappings.contactEmailColumn ? getVal(row, mappings.contactEmailColumn) : "";
        const companyName = mappings.companyNameColumn ? getVal(row, mappings.companyNameColumn) : "";

        let contactId: string | null = null;
        let companyId: string | null = null;

        if (contactEmail) {
            const contact = await prisma.contact.findFirst({
                where: {
                    email: { equals: contactEmail, mode: "insensitive" },
                    company: { listId: { in: listIds } },
                },
                select: { id: true, companyId: true },
            });
            if (contact) {
                contactId = contact.id;
                companyId = contact.companyId;
            }
        }
        if (!companyId && companyName) {
            const company = await prisma.company.findFirst({
                where: {
                    listId: { in: listIds },
                    name: { equals: companyName, mode: "insensitive" },
                },
                select: { id: true },
            });
            if (company) companyId = company.id;
        }

        if (!companyId) {
            if (missingEntityHandling === "skip") {
                skippedMissingEntity++;
                continue;
            }
            if (!fallbackListId) {
                skippedMissingEntity++;
                continue;
            }

            const defaultCompanyName = companyName
                || (contactEmail.includes("@") ? contactEmail.split("@")[1].split(".")[0] : "")
                || "Société importée";
            const normalizedCompanyName = defaultCompanyName.trim() || "Société importée";

            const existingCompany = await prisma.company.findFirst({
                where: {
                    listId: fallbackListId,
                    name: { equals: normalizedCompanyName, mode: "insensitive" },
                },
                select: { id: true },
            });

            if (existingCompany) {
                companyId = existingCompany.id;
            } else {
                const newCompany = await prisma.company.create({
                    data: {
                        listId: fallbackListId,
                        name: normalizedCompanyName,
                    },
                    select: { id: true },
                });
                companyId = newCompany.id;
                createdCompanies++;
            }
        }

        if (missingEntityHandling === "create_contact_and_company" && contactEmail && !contactId && companyId) {
            const existingContact = await prisma.contact.findFirst({
                where: {
                    companyId,
                    email: { equals: contactEmail, mode: "insensitive" },
                },
                select: { id: true },
            });
            if (existingContact) {
                contactId = existingContact.id;
            } else {
                const newContact = await prisma.contact.create({
                    data: {
                        companyId,
                        email: contactEmail,
                    },
                    select: { id: true },
                });
                contactId = newContact.id;
                createdContacts++;
            }
        }

        const meetingTypeRaw = getVal(row, mappings.meetingTypeColumn);
        const meetingType = MEETING_TYPES.includes(meetingTypeRaw as any)
            ? (meetingTypeRaw as "VISIO" | "PHYSIQUE" | "TELEPHONIQUE")
            : "VISIO";
        const meetingCategoryRaw = getVal(row, mappings.meetingCategoryColumn);
        const meetingCategory = MEETING_CATEGORIES.includes(meetingCategoryRaw as any)
            ? (meetingCategoryRaw as "EXPLORATOIRE" | "BESOIN")
            : undefined;
        const note = getVal(row, mappings.noteColumn) || undefined;
        const meetingAddress = getVal(row, mappings.meetingAddressColumn) || undefined;
        const meetingJoinUrl = getVal(row, mappings.meetingJoinUrlColumn) || undefined;
        const meetingPhone = getVal(row, mappings.meetingPhoneColumn) || undefined;

        try {
            await actionService.createAction(
                {
                    contactId: contactId ?? undefined,
                    companyId: companyId,
                    sdrId: session.user.id,
                    campaignId,
                    channel,
                    result: "MEETING_BOOKED",
                    callbackDate,
                    meetingType,
                    meetingCategory,
                    note,
                    meetingAddress,
                    meetingJoinUrl,
                    meetingPhone,
                },
                null
            );
            created++;
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Erreur création action";
            errors.push({ row: rowNum, message: msg });
        }
    }

    return NextResponse.json({
        success: true,
        data: {
            created,
            totalRows: lines.length - 1,
            errors,
            skippedInvalidDate,
            skippedMissingEntity,
            createdCompanies,
            createdContacts,
        },
    });
});
