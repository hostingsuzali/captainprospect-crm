import { prisma } from "@/lib/prisma";

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
