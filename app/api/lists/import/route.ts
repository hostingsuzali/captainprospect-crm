import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// ============================================
// CSV IMPORT API (streaming + batched for performance)
// ============================================
// Accepts multipart/form-data: file (raw CSV), missionId, listName, mappings (JSON), importType.
// Streams CSV from the uploaded file and processes rows in batches to avoid loading
// the full file and to reduce per-row DB round-trips.
// ============================================

const BATCH_SIZE = 500;

// ----- Server-side CSV parsing (same logic as client for consistent behavior) -----
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

/** Consume a Web ReadableStream and yield lines (split by \n or \r\n). */
async function* streamToLines(
    stream: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
    const reader = stream.getReader();
    const dec = new TextDecoder("utf-8", { fatal: false });
    let buffer = "";
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += dec.decode(value, { stream: true });
            const parts = buffer.split(/\r?\n/);
            buffer = parts.pop() ?? "";
            for (const line of parts) {
                yield line;
            }
        }
        if (buffer.trim()) yield buffer;
    } finally {
        reader.releaseLock();
    }
}

/** Parse a single batch of CSV lines into row objects keyed by header. */
function parseBatch(
    lines: string[],
    headers: string[],
    delimiter: string,
    startRowIndex: number
): { rowIndex: number; row: Record<string, string> }[] {
    const rows: { rowIndex: number; row: Record<string, string> }[] = [];
    for (let i = 0; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], delimiter).map((v) =>
            v.replace(/^"|"$/g, "")
        );
        const row: Record<string, string> = {};
        headers.forEach((h, j) => {
            row[h] = values[j] ?? "";
        });
        rows.push({ rowIndex: startRowIndex + i, row });
    }
    return rows;
}

/** Extract company data from a row using mappings (unchanged business logic). */
function extractCompanyFromRow(
    row: Record<string, string>,
    mappings: { csvColumn: string; targetField: string }[]
): {
    companyData: Record<string, string>;
    companyCustomData: Record<string, string>;
    hasCompanyData: boolean;
} {
    const companyData: Record<string, string> = {};
    const companyCustomData: Record<string, string> = {};
    let hasCompanyData = false;
    const standardFields = ["name", "industry", "country", "website", "size", "phone"];
    for (const mapping of mappings) {
        if (!mapping.targetField.startsWith("company.")) continue;
        const field = mapping.targetField.replace("company.", "");
        const value = row[mapping.csvColumn];
        if (!value) continue;
        if (standardFields.includes(field)) {
            companyData[field] = value.trim();
        } else {
            companyCustomData[field] = value.trim();
        }
        hasCompanyData = true;
    }
    return { companyData, companyCustomData, hasCompanyData };
}

/** Extract contact data from a row using mappings (unchanged business logic). */
function extractContactFromRow(
    row: Record<string, string>,
    mappings: { csvColumn: string; targetField: string }[]
): {
    contactData: Record<string, string>;
    contactCustomData: Record<string, string>;
    hasContactData: boolean;
} {
    const contactData: Record<string, string> = {};
    const contactCustomData: Record<string, string> = {};
    let hasContactData = false;
    const standardFields = ["firstName", "lastName", "email", "phone", "title", "linkedin"];
    for (const mapping of mappings) {
        if (!mapping.targetField.startsWith("contact.")) continue;
        const field = mapping.targetField.replace("contact.", "");
        const value = row[mapping.csvColumn];
        if (!value) continue;
        if (standardFields.includes(field)) {
            contactData[field] = value.trim();
        } else {
            contactCustomData[field] = value.trim();
        }
        hasContactData = true;
    }
    return { contactData, contactCustomData, hasContactData };
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user.role !== "MANAGER") {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 401 }
            );
        }

        // Accept multipart/form-data only (no JSON body) to avoid loading full CSV in memory
        const contentType = req.headers.get("content-type") ?? "";
        if (!contentType.includes("multipart/form-data")) {
            return NextResponse.json(
                { success: false, error: "Content-Type doit être multipart/form-data" },
                { status: 400 }
            );
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const missionId = formData.get("missionId") as string | null;
        const listName = formData.get("listName") as string | null;
        const mappingsStr = formData.get("mappings") as string | null;
        const importType = (formData.get("importType") as string) || "companies-contacts";
        const totalRowsStr = formData.get("totalRows") as string | null;
        const totalRows = totalRowsStr ? parseInt(totalRowsStr, 10) : null;

        if (!file || !missionId || !listName || !mappingsStr) {
            return NextResponse.json(
                { success: false, error: "Données manquantes (file, missionId, listName, mappings)" },
                { status: 400 }
            );
        }

        let mappings: { csvColumn: string; targetField: string }[];
        try {
            mappings = JSON.parse(mappingsStr) as { csvColumn: string; targetField: string }[];
        } catch {
            return NextResponse.json(
                { success: false, error: "mappings invalide (JSON attendu)" },
                { status: 400 }
            );
        }

        const mission = await prisma.mission.findUnique({
            where: { id: missionId },
        });
        if (!mission) {
            return NextResponse.json(
                { success: false, error: "Mission non trouvée" },
                { status: 404 }
            );
        }

        const list = await prisma.list.create({
            data: {
                name: listName,
                type: "CLIENT",
                source: "CSV Import",
                missionId,
                importConfig: {
                    importType,
                    mappings,
                    importedAt: new Date().toISOString(),
                },
            },
        });

        let companiesCreated = 0;
        let contactsCreated = 0;
        const errors: string[] = [];

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const send = (obj: object) => {
                    controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
                };
                try {
                    const fileStream = file.stream();
                    const lineIterator = streamToLines(fileStream);
                    let first = true;
                    let headers: string[] = [];
                    let delimiter = ",";
                    let lineBuffer: string[] = [];
                    let globalRowIndex = 0;

                    for await (const line of lineIterator) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;

                        if (first) {
                            first = false;
                            delimiter = detectDelimiter(trimmed);
                            headers = parseCSVLine(trimmed, delimiter).map((h) => h.replace(/^"|"$/g, ""));
                            continue;
                        }

                        lineBuffer.push(trimmed);
                        if (lineBuffer.length >= BATCH_SIZE) {
                            const rows = parseBatch(lineBuffer, headers, delimiter, globalRowIndex);
                            globalRowIndex += rows.length;
                            const { companies: batchCompanies, contacts: batchContacts, errs } = await processBatch(
                                list.id,
                                rows,
                                mappings,
                                importType
                            );
                            companiesCreated += batchCompanies;
                            contactsCreated += batchContacts;
                            errors.push(...errs);
                            lineBuffer = [];
                            const percent =
                                totalRows != null && totalRows > 0
                                    ? Math.min(100, Math.round((globalRowIndex / totalRows) * 100))
                                    : null;
                            send({ type: "progress", percent, processed: globalRowIndex });
                        }
                    }

                    if (lineBuffer.length > 0) {
                        const rows = parseBatch(lineBuffer, headers, delimiter, globalRowIndex);
                        globalRowIndex += rows.length;
                        const { companies: batchCompanies, contacts: batchContacts, errs } = await processBatch(
                            list.id,
                            rows,
                            mappings,
                            importType
                        );
                        companiesCreated += batchCompanies;
                        contactsCreated += batchContacts;
                        errors.push(...errs);
                        send({ type: "progress", percent: 100, processed: globalRowIndex });
                    }

                    send({
                        type: "done",
                        data: {
                            listId: list.id,
                            companiesCreated,
                            contactsCreated,
                            errors: errors.length,
                            errorDetails: errors.slice(0, 10),
                        },
                    });
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : "Erreur lors de l'import";
                    console.error("CSV import error:", err);
                    send({ type: "error", error: message });
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: { "Content-Type": "application/x-ndjson" },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erreur lors de l'import";
        console.error("CSV import error:", error);
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}

/** Process one batch of rows with batched DB queries (same business rules as before). */
async function processBatch(
    listId: string,
    rows: { rowIndex: number; row: Record<string, string> }[],
    mappings: { csvColumn: string; targetField: string }[],
    importType: string
): Promise<{ companies: number; contacts: number; errs: string[] }> {
    const errs: string[] = [];
    let companiesCreated = 0;
    let contactsCreated = 0;

    // 1) Build parsed rows with company/contact extraction (same validation as before)
    type RowInfo = {
        rowIndex: number;
        row: Record<string, string>;
        companyData: Record<string, string>;
        companyCustomData: Record<string, string>;
        companyName: string;
        contactData?: Record<string, string>;
        contactCustomData?: Record<string, string>;
    };
    const validRows: RowInfo[] = [];

    for (const { rowIndex, row } of rows) {
        const { companyData, companyCustomData, hasCompanyData } = extractCompanyFromRow(row, mappings);
        if (!hasCompanyData || !companyData.name) {
            errs.push(`Ligne ${rowIndex + 1}: Nom de société manquant`);
            continue;
        }
        const info: RowInfo = {
            rowIndex,
            row,
            companyData,
            companyCustomData,
            companyName: companyData.name,
        };
        if (importType === "companies-contacts") {
            const { contactData, contactCustomData, hasContactData } = extractContactFromRow(row, mappings);
            if (hasContactData && (contactData.email || contactData.firstName || contactData.lastName)) {
                info.contactData = contactData;
                info.contactCustomData = contactCustomData;
            }
        }
        validRows.push(info);
    }

    const uniqueNames = [...new Set(validRows.map((r) => r.companyName))];

    // 2) Preload existing companies for this list and batch names
    const existingCompanies = await prisma.company.findMany({
        where: { listId, name: { in: uniqueNames } },
        select: { id: true, name: true },
    });
    const companyMap = new Map<string, { id: string }>();
    for (const c of existingCompanies) {
        companyMap.set(c.name, { id: c.id });
    }

    // 3) Create missing companies: one payload per unique name (first row wins for custom data)
    const namesToCreate = uniqueNames.filter((n) => !companyMap.has(n));
    const companyPayloadByName = new Map<
        string,
        { companyData: Record<string, string>; companyCustomData: Record<string, string> }
    >();
    for (const r of validRows) {
        if (!companyMap.has(r.companyName) && !companyPayloadByName.has(r.companyName)) {
            companyPayloadByName.set(r.companyName, {
                companyData: r.companyData,
                companyCustomData: r.companyCustomData,
            });
        }
    }

    // Create missing companies one-by-one (no transaction to avoid P2028 in long-running/serverless)
    if (namesToCreate.length > 0) {
        for (const name of namesToCreate) {
            const payload = companyPayloadByName.get(name);
            if (!payload) continue;
            const { companyData, companyCustomData } = payload;
            const createData: Record<string, unknown> = {
                name: companyData.name,
                industry: companyData.industry || null,
                country: companyData.country || null,
                website: companyData.website || null,
                size: companyData.size || null,
                listId,
            };
            if (companyData.phone !== undefined && companyData.phone !== null && companyData.phone !== "") {
                (createData as Record<string, string>).phone = companyData.phone.trim();
            }
            if (Object.keys(companyCustomData).length > 0) {
                createData.customData = companyCustomData;
            }
            const created = await prisma.company.create({
                data: createData as Parameters<typeof prisma.company.create>[0]["data"],
                select: { id: true, name: true },
            });
            companyMap.set(created.name, { id: created.id });
            companiesCreated++;
        }
    }

    // 4) Contacts: preload existing for all companies in this batch (same dedup as original: email OR firstName+lastName)
    const companyIds = [...companyMap.values()].map((c) => c.id);
    const existingContacts = await prisma.contact.findMany({
        where: { companyId: { in: companyIds } },
        select: { companyId: true, email: true, firstName: true, lastName: true },
    });
    const existingContactKeys = new Set<string>();
    for (const c of existingContacts) {
        if (c.email) existingContactKeys.add(`${c.companyId}:email:${c.email}`);
        if (c.firstName != null || c.lastName != null) {
            existingContactKeys.add(`${c.companyId}:name:${c.firstName ?? ""}:${c.lastName ?? ""}`);
        }
    }

    const contactExists = (companyId: string, email: string | null, firstName: string | null, lastName: string | null) =>
        (email && existingContactKeys.has(`${companyId}:email:${email}`)) ||
        existingContactKeys.has(`${companyId}:name:${firstName ?? ""}:${lastName ?? ""}`);

    const contactsToCreate: {
        companyId: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        phone: string | null;
        title: string | null;
        linkedin: string | null;
        customData: Record<string, string> | undefined;
    }[] = [];

    for (const r of validRows) {
        const company = companyMap.get(r.companyName);
        if (!company || !r.contactData) continue;
        const cd = r.contactData;
        const email = cd.email || null;
        const firstName = cd.firstName || null;
        const lastName = cd.lastName || null;
        if (contactExists(company.id, email, firstName, lastName)) continue;
        // Mark as seen for this batch (avoid duplicate contacts within batch)
        if (email) existingContactKeys.add(`${company.id}:email:${email}`);
        existingContactKeys.add(`${company.id}:name:${firstName ?? ""}:${lastName ?? ""}`);
        contactsToCreate.push({
            companyId: company.id,
            firstName,
            lastName,
            email,
            phone: cd.phone || null,
            title: cd.title || null,
            linkedin: cd.linkedin || null,
            customData:
                r.contactCustomData && Object.keys(r.contactCustomData).length > 0 ? r.contactCustomData : undefined,
        });
    }

    if (contactsToCreate.length > 0) {
        await prisma.contact.createMany({
            data: contactsToCreate.map((c) => ({
                companyId: c.companyId,
                firstName: c.firstName,
                lastName: c.lastName,
                email: c.email,
                phone: c.phone,
                title: c.title,
                linkedin: c.linkedin,
                ...(c.customData ? { customData: c.customData } : {}),
            })),
        });
        contactsCreated = contactsToCreate.length;
    }

    return { companies: companiesCreated, contacts: contactsCreated, errs };
}
