import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import {
    buildRdvNotificationEmail,
    buildRdvEmailFromCustomTemplate,
    RdvNotificationData,
} from "@/lib/email/templates/rdv-notification";

interface CreateNotificationParams {
    userId: string;
    title: string;
    message: string;
    type?: "info" | "success" | "warning" | "error";
    link?: string;
}

/**
 * Create a notification for a user
 */
export async function createNotification({
    userId,
    title,
    message,
    type = "info",
    link,
}: CreateNotificationParams) {
    try {
        return await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type,
                link,
            },
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
        return null;
    }
}

interface TaskAssignmentNotificationParams {
    assigneeId: string;
    taskTitle: string;
    projectName: string;
    assignedByName: string;
    taskId?: string;
}

/**
 * Create a notification when a task is assigned to a user
 */
export async function createTaskAssignmentNotification({
    assigneeId,
    taskTitle,
    projectName,
    assignedByName,
}: TaskAssignmentNotificationParams) {
    return createNotification({
        userId: assigneeId,
        title: "Nouvelle tâche assignée",
        message: `"${taskTitle}" dans le projet ${projectName} - assignée par ${assignedByName}`,
        type: "info",
        link: "/developer/tasks",
    });
}

/**
 * Create a notification when a task is reassigned to a different user
 */
export async function createTaskReassignmentNotification({
    assigneeId,
    taskTitle,
    projectName,
    assignedByName,
}: TaskAssignmentNotificationParams) {
    return createNotification({
        userId: assigneeId,
        title: "Tâche réassignée",
        message: `"${taskTitle}" dans le projet ${projectName} vous a été réassignée par ${assignedByName}`,
        type: "info",
        link: "/developer/tasks",
    });
}

// ============================================
// SCHEDULE / PLANNING NOTIFICATIONS
// ============================================

interface ScheduleNotificationParams {
    userId: string;
    userRole: string;
    missionName: string;
    clientName: string;
    date: string;
    startTime: string;
    endTime: string;
    managerName: string;
}

/**
 * Create a notification when a schedule block is assigned to a user
 */
export async function createScheduleAssignmentNotification({
    userId,
    userRole,
    missionName,
    clientName,
    date,
    startTime,
    endTime,
    managerName,
}: ScheduleNotificationParams) {
    const formattedDate = new Date(date).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });

    const link = userRole === "BUSINESS_DEVELOPER" ? "/bd/dashboard" : "/sdr/dashboard";

    return createNotification({
        userId,
        title: "Nouveau créneau planifié",
        message: `Mission "${missionName}" (${clientName}) - ${formattedDate} de ${startTime} à ${endTime}. Planifié par ${managerName}`,
        type: "info",
        link,
    });
}

/**
 * Create a notification when a schedule block is updated
 */
export async function createScheduleUpdateNotification({
    userId,
    userRole,
    missionName,
    clientName,
    date,
    startTime,
    endTime,
    managerName,
}: ScheduleNotificationParams) {
    const formattedDate = new Date(date).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });

    const link = userRole === "BUSINESS_DEVELOPER" ? "/bd/dashboard" : "/sdr/dashboard";

    return createNotification({
        userId,
        title: "Créneau modifié",
        message: `Mission "${missionName}" (${clientName}) - ${formattedDate} de ${startTime} à ${endTime}. Modifié par ${managerName}`,
        type: "warning",
        link,
    });
}

interface ScheduleCancelNotificationParams {
    userId: string;
    userRole: string;
    missionName: string;
    clientName: string;
    date: string;
    startTime: string;
    endTime: string;
}

/**
 * Create a notification when a schedule block is cancelled/deleted
 */
export async function createScheduleCancelNotification({
    userId,
    userRole,
    missionName,
    clientName,
    date,
    startTime,
    endTime,
}: ScheduleCancelNotificationParams) {
    const formattedDate = new Date(date).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });

    const link = userRole === "BUSINESS_DEVELOPER" ? "/bd/dashboard" : "/sdr/dashboard";

    return createNotification({
        userId,
        title: "Créneau annulé",
        message: `Mission "${missionName}" (${clientName}) - ${formattedDate} de ${startTime} à ${endTime} a été annulé`,
        type: "warning",
        link,
    });
}

// ============================================
// CLIENT PORTAL NOTIFICATIONS
// ============================================

export interface CreateClientPortalNotificationParams {
    title: string;
    message: string;
    type?: "info" | "success" | "warning" | "error";
    link?: string;
}

/**
 * Create a notification for all active CLIENT users linked to the given client.
 * Used for: new opportunity, new RDV, new message, new file.
 */
export async function createClientPortalNotification(
    clientId: string,
    params: CreateClientPortalNotificationParams
) {
    const { title, message, type = "info", link } = params;
    try {
        const users = await prisma.user.findMany({
            where: {
                role: "CLIENT",
                clientId,
                isActive: true,
            },
            select: { id: true },
        });
        const results = await Promise.allSettled(
            users.map((u) =>
                createNotification({ userId: u.id, title, message, type, link })
            )
        );
        return results.every((r) => r.status === "fulfilled");
    } catch (error) {
        console.error("Failed to create client portal notification:", error);
        return false;
    }
}

// ============================================
// CLIENT PORTAL: ENRICHED NOTIFICATIONS
// ============================================

interface MeetingBookedNotificationData {
    contactFirstName?: string | null;
    contactLastName?: string | null;
    contactTitle?: string | null;
    companyName: string;
    sdrNote?: string | null;
}

/**
 * Notify client when SDR books a meeting.
 * Includes one sentence of SDR context inline.
 */
export async function createMeetingBookedNotification(
    clientId: string,
    data: MeetingBookedNotificationData
) {
    const name = [data.contactFirstName, data.contactLastName].filter(Boolean).join(" ") || "Contact";
    const context = data.contactTitle ? `${data.contactTitle}, ${data.companyName}` : data.companyName;
    const noteExcerpt = data.sdrNote ? ` — ${data.sdrNote.slice(0, 100)}` : "";

    return createClientPortalNotification(clientId, {
        title: "Nouveau RDV planifie",
        message: `RDV avec ${name} (${context})${noteExcerpt}`,
        type: "success",
        link: "/client/portal/meetings",
    });
}

/**
 * Notify client when monthly report is ready.
 */
export async function createReportPublishedNotification(
    clientId: string,
    monthName: string,
    year: number
) {
    return createClientPortalNotification(clientId, {
        title: "Rapport mensuel disponible",
        message: `Votre rapport ${monthName} ${year} est pret. Consultez vos resultats et partagez-le.`,
        type: "info",
        link: "/client/portal/reporting",
    });
}

/**
 * Notify client before an upcoming meeting.
 */
export async function createMeetingReminderNotification(
    clientId: string,
    data: MeetingBookedNotificationData,
    timeLabel: string
) {
    const name = [data.contactFirstName, data.contactLastName].filter(Boolean).join(" ") || "Contact";
    const noteExcerpt = data.sdrNote ? ` — ${data.sdrNote.slice(0, 80)}` : "";

    return createClientPortalNotification(clientId, {
        title: `Rappel : RDV ${timeLabel}`,
        message: `RDV avec ${name} (${data.companyName})${noteExcerpt}. Preparez votre reunion !`,
        type: "info",
        link: "/client/portal/meetings",
    });
}

/**
 * Notify client when a milestone is reached.
 */
export async function createMilestoneNotification(
    clientId: string,
    milestoneMessage: string
) {
    return createClientPortalNotification(clientId, {
        title: "Felicitations !",
        message: milestoneMessage,
        type: "success",
        link: "/client/portal/reporting",
    });
}

// ============================================
// RDV EMAIL NOTIFICATIONS
// ============================================

export interface RdvEmailNotificationData extends RdvNotificationData {
    // all fields inherited from RdvNotificationData
}

/**
 * Send a transactional email to all CLIENT users of the given clientId
 * (and to Client.email if set) when a new RDV is booked on their mission.
 *
 * Respects the per-client `rdvEmailNotificationsEnabled` toggle.
 * Uses the manager-customised SystemEmailTemplate if one exists, otherwise
 * falls back to the default dynamic template.
 *
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function sendNewRdvEmailNotification(
    clientId: string,
    data: RdvEmailNotificationData
): Promise<void> {
    try {
        const [clientUsers, client, customTemplate] = await Promise.all([
            prisma.user.findMany({
                where: { role: "CLIENT", clientId, isActive: true },
                select: { email: true },
            }),
            prisma.client.findUnique({
                where: { id: clientId },
                select: { email: true, rdvEmailNotificationsEnabled: true },
            }),
            (prisma as any).systemEmailTemplate.findUnique({
                where: { key: "rdv_notification" },
                select: { subject: true, bodyHtml: true },
            }),
        ]);

        // Respect per-client opt-out (default true if field doesn't exist yet)
        if (client?.rdvEmailNotificationsEnabled === false) {
            return;
        }

        const recipients = new Set<string>();
        for (const u of clientUsers) {
            if (u.email) recipients.add(u.email);
        }
        if (client?.email) recipients.add(client.email);

        if (recipients.size === 0) {
            return;
        }

        // Use custom DB template if available, otherwise use default dynamic builder
        const { subject, html } = customTemplate
            ? buildRdvEmailFromCustomTemplate(customTemplate.subject, customTemplate.bodyHtml, data)
            : buildRdvNotificationEmail(data);

        await Promise.allSettled(
            Array.from(recipients).map((email) =>
                sendTransactionalEmail({ to: email, subject, html })
            )
        );
    } catch (error) {
        console.error("[sendNewRdvEmailNotification] Failed:", error);
    }
}
