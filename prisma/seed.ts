import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ============================================
// PERMISSION DEFINITIONS
// ============================================

interface PermissionDef {
    code: string;
    name: string;
    description: string;
    category: string;
}

const PERMISSIONS: PermissionDef[] = [
    // Pages - Manager
    { code: "pages.dashboard", name: "Dashboard", description: "Accès au tableau de bord", category: "pages" },
    { code: "pages.clients", name: "Clients", description: "Accès à la gestion des clients", category: "pages" },
    { code: "pages.missions", name: "Missions", description: "Accès à la gestion des missions", category: "pages" },
    { code: "pages.campaigns", name: "Campagnes", description: "Accès à la gestion des campagnes", category: "pages" },
    { code: "pages.lists", name: "Listes", description: "Accès à la gestion des listes", category: "pages" },
    { code: "pages.analytics", name: "Analytics", description: "Accès aux statistiques et analytics", category: "pages" },
    { code: "pages.planning", name: "Planning", description: "Accès au planning des SDRs", category: "pages" },
    { code: "pages.files", name: "Fichiers", description: "Accès à la gestion des fichiers", category: "pages" },
    { code: "pages.users", name: "Utilisateurs", description: "Accès à la gestion des utilisateurs", category: "pages" },
    { code: "pages.sdrs", name: "SDRs", description: "Accès à la liste des SDRs", category: "pages" },
    { code: "pages.projects", name: "Projets", description: "Accès à la gestion des projets", category: "pages" },
    
    // Pages - Email Hub
    { code: "pages.email", name: "Email Hub", description: "Accès au hub email", category: "pages" },
    { code: "pages.comms", name: "Communication", description: "Accès au module de communication", category: "pages" },
    
    // Pages - SDR/BD
    { code: "pages.action", name: "Actions", description: "Accès à la page d'actions SDR", category: "pages" },
    { code: "pages.opportunities", name: "Opportunités", description: "Accès aux opportunités", category: "pages" },
    { code: "pages.settings", name: "Paramètres", description: "Accès aux paramètres personnels", category: "pages" },
    { code: "pages.portfolio", name: "Portfolio", description: "Accès au portfolio BD", category: "pages" },
    { code: "pages.onboarding", name: "Onboarding", description: "Accès à l'onboarding client", category: "pages" },
    
    // Features - Mission Management
    { code: "features.create_mission", name: "Créer mission", description: "Peut créer de nouvelles missions", category: "features" },
    { code: "features.edit_mission", name: "Modifier mission", description: "Peut modifier les missions existantes", category: "features" },
    { code: "features.delete_mission", name: "Supprimer mission", description: "Peut supprimer des missions", category: "features" },
    { code: "features.assign_sdr", name: "Assigner SDR", description: "Peut assigner des SDRs aux missions", category: "features" },
    
    // Features - List Management
    { code: "features.create_list", name: "Créer liste", description: "Peut créer de nouvelles listes", category: "features" },
    { code: "features.edit_list", name: "Modifier liste", description: "Peut modifier les listes existantes", category: "features" },
    { code: "features.delete_list", name: "Supprimer liste", description: "Peut supprimer des listes", category: "features" },
    { code: "features.import_lists", name: "Importer listes", description: "Peut importer des listes CSV/Excel", category: "features" },
    { code: "features.export_data", name: "Exporter données", description: "Peut exporter les données", category: "features" },
    
    // Features - Campaign Management
    { code: "features.create_campaign", name: "Créer campagne", description: "Peut créer de nouvelles campagnes", category: "features" },
    { code: "features.edit_campaign", name: "Modifier campagne", description: "Peut modifier les campagnes", category: "features" },
    { code: "features.delete_campaign", name: "Supprimer campagne", description: "Peut supprimer des campagnes", category: "features" },
    
    // Features - Client Management
    { code: "features.create_client", name: "Créer client", description: "Peut créer de nouveaux clients", category: "features" },
    { code: "features.edit_client", name: "Modifier client", description: "Peut modifier les clients", category: "features" },
    { code: "features.delete_client", name: "Supprimer client", description: "Peut supprimer des clients", category: "features" },
    
    // Features - User Management
    { code: "features.create_user", name: "Créer utilisateur", description: "Peut créer de nouveaux utilisateurs", category: "features" },
    { code: "features.edit_user", name: "Modifier utilisateur", description: "Peut modifier les utilisateurs", category: "features" },
    { code: "features.delete_user", name: "Supprimer utilisateur", description: "Peut supprimer des utilisateurs", category: "features" },
    { code: "features.manage_permissions", name: "Gérer permissions", description: "Peut gérer les permissions des utilisateurs", category: "features" },
    { code: "features.ban_user", name: "Bannir utilisateur", description: "Peut bannir/débannir des utilisateurs", category: "features" },
    
    // Features - File Management
    { code: "features.upload_files", name: "Téléverser fichiers", description: "Peut téléverser des fichiers", category: "features" },
    { code: "features.delete_files", name: "Supprimer fichiers", description: "Peut supprimer des fichiers", category: "features" },
    { code: "features.manage_folders", name: "Gérer dossiers", description: "Peut créer/modifier/supprimer des dossiers", category: "features" },
    
    // Actions - SDR Operations
    { code: "actions.make_calls", name: "Passer appels", description: "Peut effectuer des appels", category: "actions" },
    { code: "actions.send_emails", name: "Envoyer emails", description: "Peut envoyer des emails", category: "actions" },
    { code: "actions.send_linkedin", name: "Envoyer LinkedIn", description: "Peut envoyer des messages LinkedIn", category: "actions" },
    { code: "actions.book_meetings", name: "Réserver RDV", description: "Peut réserver des rendez-vous", category: "actions" },
    { code: "actions.create_opportunity", name: "Créer opportunité", description: "Peut créer des opportunités", category: "actions" },
    { code: "actions.edit_contacts", name: "Modifier contacts", description: "Peut modifier les informations de contact", category: "actions" },
    
    // Billing Module
    { code: "pages.billing", name: "Facturation", description: "Accès à la gestion de la facturation", category: "pages" },
    { code: "features.create_invoice", name: "Créer facture", description: "Peut créer de nouvelles factures", category: "features" },
    { code: "features.validate_invoice", name: "Valider facture", description: "Peut valider et générer des factures", category: "features" },
    { code: "features.sync_payments", name: "Synchroniser paiements", description: "Peut synchroniser les paiements Qonto", category: "features" },
    { code: "features.confirm_payment", name: "Confirmer paiement", description: "Peut confirmer les paiements détectés", category: "features" },
    
    // Prospect Orchestration Engine
    { code: "pages.prospects", name: "Prospects", description: "Accès à la gestion des prospects", category: "pages" },
    { code: "features.manage_prospect_rules", name: "Gérer règles prospects", description: "Peut créer et modifier les règles de prospects", category: "features" },
    { code: "features.review_prospects", name: "Réviser prospects", description: "Peut approuver ou rejeter les prospects", category: "features" },
    { code: "features.configure_prospect_sources", name: "Configurer sources prospects", description: "Peut configurer les sources de prospects", category: "features" },
    { code: "features.activate_prospects", name: "Activer prospects", description: "Peut activer manuellement les prospects", category: "features" },
];

// Role-based default permissions
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
    MANAGER: [
        // Full access to all pages
        "pages.dashboard", "pages.clients", "pages.missions", "pages.campaigns", 
        "pages.lists", "pages.analytics", "pages.planning", "pages.files", 
        "pages.users", "pages.sdrs", "pages.projects", "pages.settings", "pages.email", "pages.comms",
        // Full access to all features
        "features.create_mission", "features.edit_mission", "features.delete_mission", "features.assign_sdr",
        "features.create_list", "features.edit_list", "features.delete_list", "features.import_lists", "features.export_data",
        "features.create_campaign", "features.edit_campaign", "features.delete_campaign",
        "features.create_client", "features.edit_client", "features.delete_client",
        "features.create_user", "features.edit_user", "features.delete_user", "features.manage_permissions", "features.ban_user",
        "features.upload_files", "features.delete_files", "features.manage_folders",
        // Billing features
        "pages.billing", "features.create_invoice", "features.validate_invoice", "features.sync_payments", "features.confirm_payment",
        // Prospect Orchestration Engine
        "pages.prospects", "features.manage_prospect_rules", "features.review_prospects", 
        "features.configure_prospect_sources", "features.activate_prospects",
        // All actions
        "actions.make_calls", "actions.send_emails", "actions.send_linkedin", 
        "actions.book_meetings", "actions.create_opportunity", "actions.edit_contacts",
    ],
    SDR: [
        // Limited pages
        "pages.dashboard", "pages.action", "pages.lists", "pages.opportunities", "pages.settings", "pages.email", "pages.comms",
        // Limited features
        "features.export_data",
        // SDR actions
        "actions.make_calls", "actions.send_emails", "actions.send_linkedin", 
        "actions.book_meetings", "actions.create_opportunity", "actions.edit_contacts",
    ],
    BUSINESS_DEVELOPER: [
        // BD pages (superset of SDR)
        "pages.dashboard", "pages.action", "pages.lists", "pages.opportunities", "pages.settings", "pages.email", "pages.comms",
        "pages.portfolio", "pages.onboarding", "pages.clients", "pages.missions", "pages.campaigns", "pages.projects",
        // BD features
        "features.create_mission", "features.edit_mission",
        "features.create_list", "features.edit_list", "features.import_lists", "features.export_data",
        "features.create_campaign", "features.edit_campaign",
        "features.create_client", "features.edit_client",
        // All actions
        "actions.make_calls", "actions.send_emails", "actions.send_linkedin", 
        "actions.book_meetings", "actions.create_opportunity", "actions.edit_contacts",
    ],
    CLIENT: [
        // Client pages only
        "pages.dashboard", "pages.analytics", "pages.files",
        // No features
        // No actions
    ],
    DEVELOPER: [
        // Developer pages
        "pages.dashboard", "pages.projects", "pages.settings", "pages.files", "pages.comms",
        // Developer features
        "features.upload_files", "features.manage_folders",
        // No actions
    ],
};

async function seedPermissions() {
    console.log("\n📋 Seeding permissions...");
    
    // Create all permissions
    for (const perm of PERMISSIONS) {
        await prisma.permission.upsert({
            where: { code: perm.code },
            update: {
                name: perm.name,
                description: perm.description,
                category: perm.category,
            },
            create: perm,
        });
    }
    console.log(`✅ Created ${PERMISSIONS.length} permissions`);
    
    // Create role permissions
    let rolePermCount = 0;
    for (const [role, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
        for (const code of permCodes) {
            const permission = await prisma.permission.findUnique({ where: { code } });
            if (permission) {
                await prisma.rolePermission.upsert({
                    where: {
                        role_permissionId: {
                            role: role as UserRole,
                            permissionId: permission.id,
                        },
                    },
                    update: { granted: true },
                    create: {
                        role: role as UserRole,
                        permissionId: permission.id,
                        granted: true,
                    },
                });
                rolePermCount++;
            }
        }
    }
    console.log(`✅ Created ${rolePermCount} role-permission mappings`);
}

// GLOBAL action status definitions (mirrors current ActionResult enum + workflow behavior)
const GLOBAL_STATUS_DEFINITIONS = [
    { code: "NO_RESPONSE", label: "Pas de réponse", sortOrder: 1, requiresNote: false, priorityLabel: "RETRY" as const, priorityOrder: 4, triggersOpportunity: false, triggersCallback: false },
    { code: "BAD_CONTACT", label: "Standard / Mauvais contact", sortOrder: 2, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
    { code: "INTERESTED", label: "Intéressé", sortOrder: 3, requiresNote: true, priorityLabel: "FOLLOW_UP" as const, priorityOrder: 2, triggersOpportunity: true, triggersCallback: false },
    { code: "CALLBACK_REQUESTED", label: "Rappel demandé", sortOrder: 4, requiresNote: true, priorityLabel: "CALLBACK" as const, priorityOrder: 1, triggersOpportunity: false, triggersCallback: true },
    { code: "MEETING_BOOKED", label: "Meeting booké", sortOrder: 5, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: true, triggersCallback: false },
    { code: "MEETING_CANCELLED", label: "Meeting annulé", sortOrder: 6, requiresNote: false, priorityLabel: "RETRY" as const, priorityOrder: 4, triggersOpportunity: false, triggersCallback: false },
    { code: "DISQUALIFIED", label: "Disqualifié", sortOrder: 7, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
    { code: "ENVOIE_MAIL", label: "Envoie mail", sortOrder: 8, requiresNote: true, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
];

async function seedActionStatusDefinitions() {
    for (const def of GLOBAL_STATUS_DEFINITIONS) {
        await prisma.actionStatusDefinition.upsert({
            where: {
                scopeType_scopeId_code: {
                    scopeType: "GLOBAL",
                    scopeId: "",
                    code: def.code,
                },
            },
            update: {
                label: def.label,
                sortOrder: def.sortOrder,
                requiresNote: def.requiresNote,
                priorityLabel: def.priorityLabel,
                priorityOrder: def.priorityOrder,
                triggersOpportunity: def.triggersOpportunity,
                triggersCallback: def.triggersCallback,
                isActive: true,
            },
            create: {
                scopeType: "GLOBAL",
                scopeId: "",
                code: def.code,
                label: def.label,
                sortOrder: def.sortOrder,
                requiresNote: def.requiresNote,
                priorityLabel: def.priorityLabel,
                priorityOrder: def.priorityOrder,
                triggersOpportunity: def.triggersOpportunity,
                triggersCallback: def.triggersCallback,
                isActive: true,
            },
        });
    }
    console.log("✅ Seeded GLOBAL action status definitions");
}

async function main() {
    console.log("🌱 Seeding database...");

    // Hash password for all test users
    const password = await bcrypt.hash("test123", 10);

    // Create test client (company)
    const client = await prisma.client.upsert({
        where: { id: "client-001" },
        update: {},
        create: {
            id: "client-001",
            name: "TechCorp Solutions",
            email: "contact@techcorp.com",
        },
    });
    console.log("✅ Created client:", client.name);

    // Create SDR user
    const sdr = await prisma.user.upsert({
        where: { email: "sdr@suzali.com" },
        update: {},
        create: {
            email: "sdr@suzali.com",
            password,
            name: "Marie Laurent",
            role: "SDR",
        },
    });
    console.log("✅ Created SDR user:", sdr.email);

    // Create Manager user
    const manager = await prisma.user.upsert({
        where: { email: "manager@suzali.com" },
        update: {},
        create: {
            email: "manager@suzali.com",
            password,
            name: "Thomas Durand",
            role: "MANAGER",
        },
    });
    console.log("✅ Created Manager user:", manager.email);

    // Create Client user
    const clientUser = await prisma.user.upsert({
        where: { email: "client@techcorp.com" },
        update: {},
        create: {
            email: "client@techcorp.com",
            password,
            name: "Jean Dupont",
            role: "CLIENT",
            clientId: client.id,
        },
    });
    console.log("✅ Created Client user:", clientUser.email);

    // Create a mission
    const mission = await prisma.mission.upsert({
        where: { id: "mission-001" },
        update: {},
        create: {
            id: "mission-001",
            clientId: client.id,
            name: "Prospection SaaS Q1 2026",
            objective: "Générer 50 meetings qualifiés",
            channel: "CALL",
            startDate: new Date("2026-01-01"),
            endDate: new Date("2026-03-31"),
            isActive: true,
        },
    });
    console.log("✅ Created mission:", mission.name);

    // Assign SDR to mission
    await prisma.sDRAssignment.upsert({
        where: {
            missionId_sdrId: {
                missionId: mission.id,
                sdrId: sdr.id,
            },
        },
        update: {},
        create: {
            missionId: mission.id,
            sdrId: sdr.id,
        },
    });
    console.log("✅ Assigned SDR to mission");

    // Create a campaign
    const campaign = await prisma.campaign.upsert({
        where: { id: "campaign-001" },
        update: {},
        create: {
            id: "campaign-001",
            missionId: mission.id,
            name: "Outbound Calls - Tech Startups",
            icp: "Tech startups, 10-50 employees, Series A/B",
            pitch: "Bonjour, je vous appelle de la part de TechCorp. Je souhaitais échanger quelques minutes concernant vos besoins en solutions digitales.",
            script: "1. Introduction\n2. Qualification du besoin\n3. Proposition de RDV\n4. Confirmation",
            isActive: true,
        },
    });
    console.log("✅ Created campaign:", campaign.name);

    // Create a list
    const list = await prisma.list.upsert({
        where: { id: "list-001" },
        update: {},
        create: {
            id: "list-001",
            missionId: mission.id,
            name: "Tech Startups France",
            type: "SUZALI",
            source: "Apollo",
        },
    });
    console.log("✅ Created list:", list.name);

    // Create sample companies and contacts
    const companies = [
        { name: "Innovatech", country: "France", industry: "SaaS" },
        { name: "DataFlow", country: "France", industry: "Analytics" },
        { name: "CloudNine", country: "France", industry: "Cloud" },
    ];

    for (const companyData of companies) {
        const company = await prisma.company.create({
            data: {
                listId: list.id,
                name: companyData.name,
                country: companyData.country,
                industry: companyData.industry,
                status: "ACTIONABLE",
            },
        });

        // Create a contact for each company
        await prisma.contact.create({
            data: {
                companyId: company.id,
                firstName: "Contact",
                lastName: companyData.name,
                title: "CEO",
                email: `contact@${companyData.name.toLowerCase()}.com`,
                phone: "+33 6 12 34 56 78",
                status: "ACTIONABLE",
            },
        });
    }
    console.log("✅ Created 3 companies with contacts");

    // Seed GLOBAL action status definitions (config-driven workflow defaults)
    await seedActionStatusDefinitions();

    // Seed permissions
    await seedPermissions();

    // Seed CompanyIssuer (Suzali Conseil)
    const companyIssuer = await prisma.companyIssuer.upsert({
        where: { siret: "12345678901234" }, // Replace with actual SIRET
        update: {},
        create: {
            legalName: "Suzali Conseil",
            address: "123 Rue de la République",
            city: "Paris",
            postalCode: "75001",
            country: "France",
            siret: "12345678901234", // Replace with actual SIRET
            vatNumber: "FR12345678901", // Replace with actual VAT number
            email: "contact@suzali.fr",
            phone: "+33 1 23 45 67 89",
        },
    });
    console.log("✅ Created CompanyIssuer:", companyIssuer.legalName);

    console.log("\n🎉 Seeding complete!\n");
    console.log("📋 Test Credentials:");
    console.log("─────────────────────────────────────");
    console.log("SDR:      sdr@suzali.com / test123");
    console.log("Manager:  manager@suzali.com / test123");
    console.log("Client:   client@techcorp.com / test123");
    console.log("─────────────────────────────────────\n");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
