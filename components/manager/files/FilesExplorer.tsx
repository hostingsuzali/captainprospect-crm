"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge, Button, Card, Input, Modal, ModalFooter, PageHeader, useToast } from "@/components/ui";
import {
  ChevronRight,
  Cloud,
  Download,
  ExternalLink,
  File as FileIcon,
  FileAudio,
  FileCode,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  Home,
  Import,
  Info,
  Image,
  Link2,
  Loader2,
  MoreVertical,
  Pencil,
  Search,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  Video,
  Archive,
  X,
  Move,
  Check,
} from "lucide-react";
import { useDropzone } from "react-dropzone";

interface FolderItem {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  createdAt?: string;
  _count: { files: number; children: number };
}

interface FileItem {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  formattedSize: string;
  url?: string;
  createdAt: string;
  uploadedBy?: { id: string; name: string };
  tags?: string[];
  // Drive
  source?: "crm" | "google_drive";
  webViewLink?: string;
  thumbnailLink?: string;
}

type ActiveTab = "crm" | "drive" | "all";
type ItemKind = "file" | "folder";

type MenuAccent = "indigo" | "blue" | "amber" | "emerald" | "purple" | "pink" | "red" | "cyan" | "slate";

function menuAccentForMime(mimeType: string): MenuAccent {
  if (!mimeType) return "indigo";
  if (mimeType.startsWith("image/")) return "purple";
  if (mimeType.startsWith("video/")) return "pink";
  if (mimeType.startsWith("audio/")) return "amber";
  if (mimeType.includes("pdf")) return "red";
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv")) return "emerald";
  if (mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("code")) return "cyan";
  return "indigo";
}

function menuAccentGradient(accent: MenuAccent) {
  const map: Record<MenuAccent, string> = {
    indigo: "from-indigo-500 to-purple-500",
    blue: "from-blue-500 to-cyan-500",
    amber: "from-amber-500 to-orange-500",
    emerald: "from-emerald-500 to-teal-500",
    purple: "from-purple-500 to-violet-500",
    pink: "from-pink-500 to-rose-500",
    red: "from-red-500 to-orange-500",
    cyan: "from-cyan-500 to-sky-500",
    slate: "from-slate-600 to-slate-800",
  };
  return map[accent];
}

function menuHoverTint(accent: MenuAccent) {
  const map: Record<MenuAccent, string> = {
    indigo: "hover:bg-indigo-50",
    blue: "hover:bg-blue-50",
    amber: "hover:bg-amber-50",
    emerald: "hover:bg-emerald-50",
    purple: "hover:bg-purple-50",
    pink: "hover:bg-pink-50",
    red: "hover:bg-red-50",
    cyan: "hover:bg-cyan-50",
    slate: "hover:bg-slate-50",
  };
  return map[accent];
}

function downloadUrl(fileId: string) {
  // Internal authenticated download endpoint.
  return `${window.location.origin}/api/files/${fileId}/download`;
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatDateShort(dateString: string) {
  const d = new Date(dateString);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function typeLabel(mimeType: string) {
  if (!mimeType) return "Fichier";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("video/")) return "Vidéo";
  if (mimeType.startsWith("audio/")) return "Audio";
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv")) return "Tableur";
  if (mimeType.includes("word") || mimeType.includes("document")) return "Document";
  return "Fichier";
}

function typeIcon(mimeType: string) {
  if (!mimeType) return { Icon: FileIcon, bg: "bg-slate-100", fg: "text-slate-600", ring: "ring-slate-200/60" };
  if (mimeType.startsWith("image/")) return { Icon: Image, bg: "bg-purple-50", fg: "text-purple-600", ring: "ring-purple-200/60" };
  if (mimeType.startsWith("video/")) return { Icon: Video, bg: "bg-pink-50", fg: "text-pink-600", ring: "ring-pink-200/60" };
  if (mimeType.startsWith("audio/")) return { Icon: FileAudio, bg: "bg-amber-50", fg: "text-amber-700", ring: "ring-amber-200/60" };
  if (mimeType.includes("pdf")) return { Icon: FileText, bg: "bg-red-50", fg: "text-red-600", ring: "ring-red-200/60" };
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return { Icon: FileSpreadsheet, bg: "bg-emerald-50", fg: "text-emerald-700", ring: "ring-emerald-200/60" };
  if (mimeType.includes("word") || mimeType.includes("document"))
    return { Icon: FileText, bg: "bg-blue-50", fg: "text-blue-600", ring: "ring-blue-200/60" };
  if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("compressed"))
    return { Icon: Archive, bg: "bg-yellow-50", fg: "text-yellow-700", ring: "ring-yellow-200/60" };
  if (mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("code"))
    return { Icon: FileCode, bg: "bg-cyan-50", fg: "text-cyan-700", ring: "ring-cyan-200/60" };
  return { Icon: FileIcon, bg: "bg-slate-100", fg: "text-slate-600", ring: "ring-slate-200/60" };
}

function ItemMenu({
  onShareLink,
  onShareDirect,
  onRename,
  onMove,
  onDelete,
  onDetails,
  isDriveItem,
  onOpenExternal,
  onImport,
  accent = "slate",
}: {
  onShareLink: () => void;
  onShareDirect: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onDetails: () => void;
  isDriveItem?: boolean;
  onOpenExternal?: () => void;
  onImport?: () => void;
  accent?: MenuAccent;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; placement: "bottom" | "top" } | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!open) return;
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Initial anchor positioning (fixed) so it won't be clipped by overflow hidden parents.
  useLayoutEffect(() => {
    if (!open) return;
    if (!btnRef.current) return;
    if (typeof window === "undefined") return;

    const rect = btnRef.current.getBoundingClientRect();
    const assumedWidth = 224; // Tailwind w-56
    const gutter = 10;
    const left = Math.min(Math.max(rect.right - assumedWidth, gutter), window.innerWidth - assumedWidth - gutter);
    const top = rect.bottom + 10;
    setPos({ top, left, placement: "bottom" });
  }, [open]);

  // After mount, measure and keep within viewport (flip if needed).
  useLayoutEffect(() => {
    if (!open) return;
    if (!pos) return;
    if (!menuRef.current) return;
    if (typeof window === "undefined") return;

    const gutter = 10;
    const rectBtn = btnRef.current?.getBoundingClientRect();
    const rectMenu = menuRef.current.getBoundingClientRect();
    if (!rectBtn) return;

    let left = pos.left;
    let top = pos.top;
    let placement: "bottom" | "top" = pos.placement;

    // Clamp horizontal
    left = Math.min(Math.max(left, gutter), window.innerWidth - rectMenu.width - gutter);

    // Flip to top if overflow bottom
    const wouldOverflowBottom = top + rectMenu.height + gutter > window.innerHeight;
    if (wouldOverflowBottom) {
      placement = "top";
      top = Math.max(gutter, rectBtn.top - rectMenu.height - 10);
    }

    if (left !== pos.left || top !== pos.top || placement !== pos.placement) {
      setPos({ left, top, placement });
    }
  }, [open, pos]);

  // Reposition on scroll/resize while open (Google-like).
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;

    const onReposition = () => {
      if (!btnRef.current) return;
      const rect = btnRef.current.getBoundingClientRect();
      const assumedWidth = 224;
      const gutter = 10;
      const left = Math.min(Math.max(rect.right - assumedWidth, gutter), window.innerWidth - assumedWidth - gutter);
      const top = rect.bottom + 10;
      setPos({ top, left, placement: "bottom" });
    };

    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
        title="Actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open &&
        typeof document !== "undefined" &&
        pos &&
        createPortal(
          <div
            className="fixed z-[9999]"
            style={{ top: pos.top, left: pos.left, width: 224 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* pointer */}
            <div
              className={classNames(
                "absolute right-4 w-4 h-4 rotate-45 bg-white/90 border border-slate-200/80 backdrop-blur-xl shadow-sm",
                pos.placement === "bottom" ? "-top-2" : "bottom-[-8px]"
              )}
            />
            <div
              ref={menuRef}
              className={classNames(
                "rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-xl",
                "shadow-2xl shadow-slate-300/50 ring-1 ring-black/5 overflow-hidden",
                "animate-scale-in"
              )}
            >
              <div className={classNames("h-1.5 bg-gradient-to-r", menuAccentGradient(accent))} />

              <button
                className={classNames(
                  "w-full px-3 py-2.5 text-sm text-left flex items-center gap-2 text-slate-700",
                  menuHoverTint(accent)
                )}
                onClick={() => {
                  setOpen(false);
                  onDetails();
                }}
              >
                <Info className="w-4 h-4 text-slate-500" />
                Détails
              </button>

              <button
                className={classNames(
                  "w-full px-3 py-2.5 text-sm text-left flex items-center gap-2 text-slate-700",
                  menuHoverTint(accent)
                )}
                onClick={() => {
                  setOpen(false);
                  onShareLink();
                }}
              >
                <Link2 className="w-4 h-4 text-slate-500" />
                Partager par lien
              </button>
              <button
                className={classNames(
                  "w-full px-3 py-2.5 text-sm text-left flex items-center gap-2 text-slate-700",
                  menuHoverTint(accent)
                )}
                onClick={() => {
                  setOpen(false);
                  onShareDirect();
                }}
              >
                <UserPlus className="w-4 h-4 text-slate-500" />
                Partager directement
              </button>

              {!isDriveItem && (
                <>
                  <button
                    className={classNames(
                      "w-full px-3 py-2.5 text-sm text-left flex items-center gap-2 text-slate-700",
                      menuHoverTint(accent)
                    )}
                    onClick={() => {
                      setOpen(false);
                      onRename();
                    }}
                  >
                    <Pencil className="w-4 h-4 text-slate-500" />
                    Renommer
                  </button>
                  <button
                    className={classNames(
                      "w-full px-3 py-2.5 text-sm text-left flex items-center gap-2 text-slate-700",
                      menuHoverTint(accent)
                    )}
                    onClick={() => {
                      setOpen(false);
                      onMove();
                    }}
                  >
                    <Move className="w-4 h-4 text-slate-500" />
                    Déplacer…
                  </button>
                </>
              )}

              {isDriveItem && (
                <>
                  {onOpenExternal && (
                    <button
                      className={classNames(
                        "w-full px-3 py-2.5 text-sm text-left flex items-center gap-2 text-slate-700",
                        menuHoverTint(accent)
                      )}
                      onClick={() => {
                        setOpen(false);
                        onOpenExternal();
                      }}
                    >
                      <ExternalLink className="w-4 h-4 text-slate-500" />
                      Ouvrir dans Drive
                    </button>
                  )}
                  {onImport && (
                    <button
                      className={classNames(
                        "w-full px-3 py-2.5 text-sm text-left flex items-center gap-2 text-slate-700",
                        menuHoverTint(accent)
                      )}
                      onClick={() => {
                        setOpen(false);
                        onImport();
                      }}
                    >
                      <Import className="w-4 h-4 text-slate-500" />
                      Importer dans le CRM
                    </button>
                  )}
                </>
              )}

              <div className="h-px bg-slate-200/60" />
              <button
                className="w-full px-3 py-2.5 text-sm text-left hover:bg-red-50 flex items-center gap-2 text-red-600"
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default function FilesExplorer() {
  const { success, error: showError } = useToast();

  const [activeTab, setActiveTab] = useState<ActiveTab>("crm");

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);

  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: "Accueil" }]);

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Selection
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());

  // Details
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [details, setDetails] = useState<{ kind: ItemKind; item: FileItem | FolderItem } | null>(null);

  // Modals
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ kind: ItemKind; item: FileItem | FolderItem } | null>(null);
  const [shareMode, setShareMode] = useState<"link" | "direct">("link");

  // Right-click context menu
  const [ctxMenuPos, setCtxMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [ctxMenuTarget, setCtxMenuTarget] = useState<{ kind: ItemKind; item: FileItem | FolderItem; isDriveItem?: boolean } | null>(null);
  const [shareDirectUserIds, setShareDirectUserIds] = useState<string[]>([]);
  const [shareDirectUsers, setShareDirectUsers] = useState<Array<{ id: string; name: string | null; email: string | null }>>([]);
  const [shareDirectLoading, setShareDirectLoading] = useState(false);
  const [shareDirectSubmitting, setShareDirectSubmitting] = useState(false);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ kind: ItemKind; item: FileItem | FolderItem } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ kind: ItemKind; item: FileItem | FolderItem } | null>(null);
  const [moveDestination, setMoveDestination] = useState<string | null>(null); // folderId or null for root
  const [moving, setMoving] = useState(false);

  // Google Drive
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveEmail, setDriveEmail] = useState<string | null>(null);
  const [driveFolders, setDriveFolders] = useState<any[]>([]);
  const [driveFiles, setDriveFiles] = useState<FileItem[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [drivePath, setDrivePath] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: "Mon Drive" }]);
  const [importingFromDrive, setImportingFromDrive] = useState(false);
  const [importingFileName, setImportingFileName] = useState<string | null>(null);

  const storageUsed = useMemo(() => files.reduce((acc, f) => acc + (Number.isFinite(f.size) ? f.size : 0), 0), [files]);
  const currentLocationLabel = useMemo(() => {
    if (activeTab === "drive") return drivePath[drivePath.length - 1]?.name ?? "Mon Drive";
    return folderPath[folderPath.length - 1]?.name ?? "Accueil";
  }, [activeTab, drivePath, folderPath]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const foldersParams = new URLSearchParams();
      foldersParams.set("parentId", currentFolder ?? "root");
      const foldersRes = await fetch(`/api/folders?${foldersParams}`);
      const foldersJson = await foldersRes.json();
      if (foldersJson.success) setFolders(foldersJson.data.folders);

      const filesParams = new URLSearchParams();
      if (currentFolder) filesParams.set("folderId", currentFolder);
      if (search) filesParams.set("search", search);
      if (typeFilter) filesParams.set("type", typeFilter);
      const filesRes = await fetch(`/api/files?${filesParams}`);
      const filesJson = await filesRes.json();
      if (filesJson.success) setFiles(filesJson.data.files);
    } catch (e) {
      showError("Erreur", "Impossible de charger les fichiers.");
    } finally {
      setIsLoading(false);
    }
  }, [currentFolder, search, typeFilter, showError]);

  const fetchDriveStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/google-drive/status");
      const json = await res.json();
      if (json.success) {
        setDriveConnected(Boolean(json.data.connected));
        setDriveEmail(json.data.email ?? null);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchDrive = useCallback(async () => {
    if (!driveConnected) return;
    setDriveLoading(true);
    try {
      const params = new URLSearchParams();
      if (driveFolderId) params.set("folderId", driveFolderId);
      const res = await fetch(`/api/integrations/google-drive/files?${params}`);
      const json = await res.json();
      if (json.success) {
        setDriveFolders(json.data.folders);
        setDriveFiles(
          json.data.files.map((f: any) => ({
            ...f,
            originalName: f.name,
            source: "google_drive",
          }))
        );
      }
    } finally {
      setDriveLoading(false);
    }
  }, [driveConnected, driveFolderId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchDriveStatus();
  }, [fetchDriveStatus]);

  useEffect(() => {
    if (driveConnected) fetchDrive();
  }, [driveConnected, fetchDrive]);

  const navigateToFolder = (folderId: string | null, folderName: string) => {
    setCurrentFolder(folderId);
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());

    const idx = folderPath.findIndex((f) => f.id === folderId);
    if (idx >= 0) setFolderPath(folderPath.slice(0, idx + 1));
    else setFolderPath([...folderPath, { id: folderId, name: folderName }]);
  };

  const navigateDriveFolder = (folderId: string | null, folderName: string) => {
    setDriveFolderId(folderId);
    if (folderId === null) setDrivePath([{ id: null, name: "Mon Drive" }]);
    else {
      const idx = drivePath.findIndex((f) => f.id === folderId);
      if (idx >= 0) setDrivePath(drivePath.slice(0, idx + 1));
      else setDrivePath([...drivePath, { id: folderId, name: folderName }]);
    }
  };

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
    onDrop: async (accepted) => {
      if (!accepted.length) return;

      // Upload to Google Drive if active
      if (activeTab === "drive") {
        if (!driveConnected) {
          showError("Erreur", "Google Drive n'est pas connecté.");
          return;
        }

        try {
          for (const file of accepted) {
            const form = new FormData();
            form.append("file", file);
            if (driveFolderId) form.append("folderId", driveFolderId);

            const res = await fetch("/api/integrations/google-drive/upload", { method: "POST", body: form });
            const json = await res.json();
            if (!json.success) throw new Error("upload failed");
          }
          success("Google Drive", `${accepted.length} fichier(s) envoyé(s) sur Drive.`);
          fetchDrive();
        } catch {
          showError("Erreur", "Échec du téléchargement vers Drive.");
        }
        return;
      }

      // Default: Upload to CRM
      try {
        for (const file of accepted) {
          const form = new FormData();
          form.append("file", file);
          if (currentFolder) form.append("folderId", currentFolder);
          const res = await fetch("/api/files/upload", { method: "POST", body: form });
          const json = await res.json();
          if (!json.success) throw new Error("upload failed");
        }
        success("CRM", `${accepted.length} fichier(s) ajouté(s) au CRM.`);
        fetchData();
      } catch {
        showError("Erreur", "Échec du téléchargement.");
      }
    },
    multiple: true,
    noClick: true,
    maxSize: 100 * 1024 * 1024,
  });

  // Actions
  const onDeleteFile = async (file: FileItem) => {
    if (!confirm(`Supprimer "${file.name}" ?`)) return;
    try {
      const res = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error("delete failed");
      success("Supprimé", `"${file.name}" a été supprimé.`);
      fetchData();
    } catch {
      showError("Erreur", "Impossible de supprimer ce fichier.");
    }
  };

  const onDeleteFolder = async (folder: FolderItem) => {
    if ((folder._count.files ?? 0) > 0 || (folder._count.children ?? 0) > 0) {
      showError("Erreur", "Le dossier doit être vide pour être supprimé.");
      return;
    }
    if (!confirm(`Supprimer le dossier "${folder.name}" ?`)) return;
    try {
      const res = await fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error("delete failed");
      success("Supprimé", `"${folder.name}" a été supprimé.`);
      fetchData();
    } catch {
      showError("Erreur", "Impossible de supprimer ce dossier.");
    }
  };

  const onOpenShare = (kind: ItemKind, item: FileItem | FolderItem, mode: "link" | "direct" = "link") => {
    setShareTarget({ kind, item });
    setShareMode(mode);
    setShareOpen(true);
    setCtxMenuPos(null);
    setCtxMenuTarget(null);
    if (mode === "direct") {
      setShareDirectUserIds([]);
      setShareDirectLoading(true);
      fetch("/api/users?limit=100")
        .then((r) => r.json())
        .then((j) => {
          const list = j?.data?.users ?? j?.users;
          if (j.success && Array.isArray(list)) setShareDirectUsers(list);
        })
        .finally(() => setShareDirectLoading(false));
    }
  };

  const ctxMenuRef = useRef<HTMLDivElement | null>(null);
  const closeCtxMenu = useCallback(() => {
    setCtxMenuPos(null);
    setCtxMenuTarget(null);
  }, []);

  useEffect(() => {
    if (!ctxMenuPos) return;
    const onDoc = (e: MouseEvent) => {
      if (ctxMenuRef.current?.contains(e.target as Node)) return;
      closeCtxMenu();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [ctxMenuPos, closeCtxMenu]);

  const onCopyShare = async () => {
    if (!shareTarget) return;
    try {
      let link = "";
      if (shareTarget.kind === "file") link = downloadUrl((shareTarget.item as FileItem).id);
      else link = window.location.href;
      await navigator.clipboard.writeText(link);
      success("Lien copié", "Lien copié dans le presse-papiers.");
      setShareOpen(false);
    } catch {
      showError("Erreur", "Impossible de copier le lien.");
    }
  };

  const onShareDirectSubmit = async () => {
    if (!shareTarget || shareDirectUserIds.length === 0) return;
    setShareDirectSubmitting(true);
    try {
      const url = shareTarget.kind === "file"
        ? `/api/files/${(shareTarget.item as FileItem).id}/share`
        : `/api/folders/${(shareTarget.item as FolderItem).id}/share`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: shareDirectUserIds }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Erreur");
      success("Partagé", `Partagé avec ${shareDirectUserIds.length} utilisateur(s).`);
      setShareOpen(false);
      setShareDirectUserIds([]);
    } catch (e) {
      showError("Erreur", e instanceof Error ? e.message : "Impossible de partager.");
    } finally {
      setShareDirectSubmitting(false);
    }
  };

  const onOpenRename = (kind: ItemKind, item: FileItem | FolderItem) => {
    setRenameTarget({ kind, item });
    setRenameValue(item.name);
    setRenameOpen(true);
  };

  const onConfirmRename = async () => {
    if (!renameTarget) return;
    const nextName = renameValue.trim();
    if (!nextName) return;
    setRenaming(true);
    try {
      if (renameTarget.kind === "file") {
        const res = await fetch(`/api/files/${(renameTarget.item as FileItem).id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nextName }),
        });
        const json = await res.json();
        if (!json.success) throw new Error("rename failed");
      } else {
        const res = await fetch(`/api/folders/${(renameTarget.item as FolderItem).id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nextName }),
        });
        const json = await res.json();
        if (!json.success) throw new Error("rename failed");
      }
      success("Renommé", "Nom mis à jour.");
      setRenameOpen(false);
      setRenameTarget(null);
      fetchData();
    } catch {
      showError("Erreur", "Impossible de renommer.");
    } finally {
      setRenaming(false);
    }
  };

  const onOpenMove = (kind: ItemKind, item: FileItem | FolderItem) => {
    setMoveTarget({ kind, item });
    setMoveDestination(null);
    setMoveOpen(true);
  };

  const onConfirmMove = async () => {
    if (!moveTarget) return;
    setMoving(true);
    try {
      if (moveTarget.kind === "file") {
        const res = await fetch(`/api/files/${(moveTarget.item as FileItem).id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId: moveDestination }),
        });
        const json = await res.json();
        if (!json.success) throw new Error("move failed");
      } else {
        const res = await fetch(`/api/folders/${(moveTarget.item as FolderItem).id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentId: moveDestination }),
        });
        const json = await res.json();
        if (!json.success) throw new Error("move failed");
      }
      success("Déplacé", "Élément déplacé.");
      setMoveOpen(false);
      setMoveTarget(null);
      fetchData();
    } catch {
      showError("Erreur", "Impossible de déplacer.");
    } finally {
      setMoving(false);
    }
  };

  const onDownload = async (file: FileItem) => {
    try {
      const res = await fetch(`/api/files/${file.id}/download`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      showError("Erreur", "Téléchargement impossible.");
    }
  };

  const onConnectDrive = async () => {
    try {
      const res = await fetch("/api/integrations/google-drive/connect", { method: "POST" });
      const json = await res.json();
      if (json.success && json.data.authUrl) window.location.href = json.data.authUrl;
      else throw new Error("no url");
    } catch {
      showError("Erreur", "Connexion Google Drive impossible.");
    }
  };

  const onDisconnectDrive = async () => {
    if (!confirm("Déconnecter Google Drive ?")) return;
    try {
      const res = await fetch("/api/integrations/google-drive/disconnect", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error("failed");
      setDriveConnected(false);
      setDriveEmail(null);
      setActiveTab("crm");
      success("Déconnecté", "Google Drive déconnecté.");
    } catch {
      showError("Erreur", "Déconnexion impossible.");
    }
  };

  const onImportFromDrive = async (file: FileItem) => {
    setImportingFromDrive(true);
    setImportingFileName(file.name);
    try {
      const res = await fetch("/api/integrations/google-drive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveFileId: file.id, crmFolderId: currentFolder || undefined }),
      });
      const json = await res.json();
      if (!json.success) throw new Error("failed");
      setImportingFromDrive(false);
      setImportingFileName(null);
      success("Importé", `"${file.name}" importé dans le CRM.`);
      fetchData();
    } catch {
      setImportingFromDrive(false);
      setImportingFileName(null);
      showError("Erreur", "Import impossible.");
    }
  };

  const visibleFiles = useMemo(() => {
    return files;
  }, [files]);

  const selectionCount = selectedFiles.size + selectedFolders.size;

  const toggleSelectFile = (id: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectFolder = (id: string) => {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  };

  const bulkDelete = async () => {
    if (!selectionCount) return;
    if (!confirm(`Supprimer ${selectionCount} élément(s) ?`)) return;
    try {
      for (const id of selectedFiles) await fetch(`/api/files/${id}`, { method: "DELETE" });
      for (const id of selectedFolders) await fetch(`/api/folders/${id}`, { method: "DELETE" });
      success("Suppression", `${selectionCount} élément(s) supprimé(s).`);
      clearSelection();
      fetchData();
    } catch {
      showError("Erreur", "Suppression impossible.");
    }
  };

  const bulkCopyLinks = async () => {
    if (!selectedFiles.size) return;
    try {
      const links = Array.from(selectedFiles).map((id) => downloadUrl(id)).join("\n");
      await navigator.clipboard.writeText(links);
      success("Liens copiés", `${selectedFiles.size} lien(s) copié(s).`);
    } catch {
      showError("Erreur", "Impossible de copier les liens.");
    }
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setCreatingFolder(true);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: currentFolder }),
      });
      const json = await res.json();
      if (!json.success) throw new Error("failed");
      success("Dossier créé", `"${name}" a été créé.`);
      setCreateFolderOpen(false);
      setNewFolderName("");
      fetchData();
    } catch {
      showError("Erreur", "Création impossible.");
    } finally {
      setCreatingFolder(false);
    }
  };

  const updateTags = async (file: FileItem, tagsCsv: string) => {
    const tags = tagsCsv
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      const json = await res.json();
      if (!json.success) throw new Error("failed");
      success("Tags", "Tags mis à jour.");
      fetchData();
    } catch {
      showError("Erreur", "Impossible de mettre à jour les tags.");
    }
  };

  const rightDetails = detailsOpen && details;

  return (
    <div
      {...getRootProps()}
      className="space-y-6 rounded-[28px] bg-gradient-to-br from-slate-50 via-white to-slate-100/60 p-4 sm:p-6 border border-slate-200/70"
    >
      <input {...getInputProps()} />

      {isDragActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 text-center w-[420px]">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-6 h-6 text-indigo-600" />
            </div>
            <p className="text-lg font-semibold text-slate-900">Déposez vos fichiers</p>
            <p className="text-sm text-slate-500 mt-1">Ils seront ajoutés au dossier actuel.</p>
          </div>
        </div>
      )}

      <PageHeader
        title="Fichiers & Dossiers"
        subtitle={`Espace de travail: ${currentLocationLabel}`}
        onRefresh={fetchData}
        isRefreshing={isLoading}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setCreateFolderOpen(true)} className="gap-2">
              <FolderPlus className="w-4 h-4" />
              Nouveau dossier
            </Button>
            <Button variant="primary" onClick={openFilePicker} className="gap-2">
              <Upload className="w-4 h-4" />
              Télécharger
            </Button>
          </div>
        }
      />

      {/* Insight chips (subtle color, mature) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 bg-white/80 backdrop-blur border-slate-200/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Fichiers (CRM)</p>
              <p className="text-lg font-semibold text-slate-900">{files.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 ring-1 ring-indigo-200/60 flex items-center justify-center">
              <FileIcon className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-white/80 backdrop-blur border-slate-200/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Stockage utilisé</p>
              <p className="text-lg font-semibold text-slate-900">{formatBytes(storageUsed)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 ring-1 ring-emerald-200/60 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-emerald-700" />
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-white/80 backdrop-blur border-slate-200/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Google Drive</p>
              <p className="text-lg font-semibold text-slate-900">{driveConnected ? "Connecté" : "Non connecté"}</p>
            </div>
            <div className={classNames(
              "w-10 h-10 rounded-xl ring-1 flex items-center justify-center",
              driveConnected ? "bg-blue-50 ring-blue-200/60" : "bg-slate-100 ring-slate-200/60"
            )}>
              <Cloud className={classNames("w-5 h-5", driveConnected ? "text-blue-600" : "text-slate-500")} />
            </div>
          </div>
        </Card>
      </div>

      <div className={classNames("grid gap-6", rightDetails ? "grid-cols-12" : "grid-cols-12")}>
        {/* Sidebar */}
        <div className={classNames("col-span-12 lg:col-span-3 space-y-4", rightDetails ? "xl:col-span-3" : "xl:col-span-3")}>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Sources</div>
              {driveConnected ? (
                <Badge variant="success" className="text-[11px]">
                  Drive connecté
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px]">
                  Drive non connecté
                </Badge>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                className={classNames(
                  "flex-1 px-3 py-2 rounded-xl border text-sm font-medium transition-colors",
                  activeTab === "crm"
                    ? "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-indigo-700 shadow-sm shadow-indigo-500/10"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                )}
                onClick={() => setActiveTab("crm")}
              >
                <span className="inline-flex items-center gap-2">
                  <HardDrive className="w-4 h-4" />
                  CRM
                </span>
              </button>
              <button
                className={classNames(
                  "flex-1 px-3 py-2 rounded-xl border text-sm font-medium transition-colors",
                  activeTab === "drive"
                    ? "bg-gradient-to-br from-blue-600 to-cyan-600 text-white border-blue-700 shadow-sm shadow-blue-500/10"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
                  !driveConnected && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => driveConnected && setActiveTab("drive")}
                disabled={!driveConnected}
              >
                <span className="inline-flex items-center gap-2">
                  <Cloud className="w-4 h-4" />
                  Drive
                </span>
              </button>
            </div>

            <div className="mt-3">
              {!driveConnected ? (
                <Button variant="secondary" className="w-full gap-2" onClick={onConnectDrive}>
                  <Cloud className="w-4 h-4" />
                  Connecter Google Drive
                </Button>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Connecté</p>
                    <p className="text-sm font-medium text-slate-900 truncate">{driveEmail}</p>
                  </div>
                  <Button variant="ghost" onClick={onDisconnectDrive}>
                    Déconnecter
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {activeTab !== "drive" && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-slate-900">Dossiers</div>
                <Badge variant="default" className="text-[11px]">
                  {folders.length}
                </Badge>
              </div>

              <div className="space-y-1">
                {folderPath.map((f, idx) => (
                  <div key={f.id ?? "root"} className="flex items-center gap-1 text-sm">
                    {idx > 0 && <ChevronRight className="w-4 h-4 text-slate-300" />}
                    <button
                      className={classNames(
                        "px-2 py-1 rounded-lg transition-colors",
                        idx === folderPath.length - 1 ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                      )}
                      onClick={() => navigateToFolder(f.id, f.name)}
                    >
                      <span className="inline-flex items-center gap-2">
                        {idx === 0 ? <Home className="w-4 h-4" /> : <Folder className="w-4 h-4 text-amber-500" />}
                        {f.name}
                      </span>
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1 max-h-[420px] overflow-auto pr-1">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className={classNames(
                      "group flex items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-50 border border-transparent",
                      selectedFolders.has(folder.id) && "bg-indigo-50 border-indigo-100 shadow-sm"
                    )}
                    onClick={() => navigateToFolder(folder.id, folder.name)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCtxMenuPos({ x: e.clientX, y: e.clientY });
                      setCtxMenuTarget({ kind: "folder", item: folder, isDriveItem: false });
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        className={classNames(
                          "w-5 h-5 rounded-md border flex items-center justify-center",
                          selectedFolders.has(folder.id) ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-transparent group-hover:text-slate-500"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectFolder(folder.id);
                        }}
                        title="Sélectionner"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{folder.name}</p>
                        <p className="text-xs text-slate-500">
                          {folder._count.files} fichier(s) • {folder._count.children} sous-dossier(s)
                        </p>
                      </div>
                    </div>
                    <div className="hidden xl:flex items-center gap-2">
                      {typeof folder._count.files === "number" && folder._count.files > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200/60">
                          {folder._count.files} fichiers
                        </span>
                      )}
                    </div>
                    <ItemMenu
                      onDetails={() => {
                        setDetails({ kind: "folder", item: folder });
                        setDetailsOpen(true);
                      }}
                      accent="amber"
                      onShareLink={() => onOpenShare("folder", folder, "link")}
                      onShareDirect={() => onOpenShare("folder", folder, "direct")}
                      onRename={() => onOpenRename("folder", folder)}
                      onMove={() => onOpenMove("folder", folder)}
                      onDelete={() => onDeleteFolder(folder)}
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === "drive" && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-slate-900">Google Drive</div>
                {driveLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
              </div>
              <div className="space-y-1">
                {drivePath.map((f, idx) => (
                  <div key={f.id ?? "root-drive"} className="flex items-center gap-1 text-sm">
                    {idx > 0 && <ChevronRight className="w-4 h-4 text-slate-300" />}
                    <button
                      className={classNames(
                        "px-2 py-1 rounded-lg transition-colors",
                        idx === drivePath.length - 1 ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                      )}
                      onClick={() => navigateDriveFolder(f.id, f.name)}
                    >
                      <span className="inline-flex items-center gap-2">
                        {idx === 0 ? <Cloud className="w-4 h-4 text-blue-500" /> : <Folder className="w-4 h-4 text-blue-500" />}
                        {f.name}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-1 max-h-[420px] overflow-auto pr-1">
                {driveFolders.map((f: any) => (
                  <button
                    key={f.id}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 text-left"
                    onClick={() => navigateDriveFolder(f.id, f.name)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCtxMenuPos({ x: e.clientX, y: e.clientY });
                      setCtxMenuTarget({ kind: "folder", item: { id: f.id, name: f.name, _count: { files: 0, children: 0 } }, isDriveItem: true });
                    }}
                  >
                    <Folder className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-slate-900 truncate">{f.name}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Main */}
        <div className={classNames("col-span-12 lg:col-span-9 space-y-4", rightDetails ? "xl:col-span-6" : "xl:col-span-9")}>
          <Card className="p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher (nom, tags, description)…"
                  icon={<Search className="w-4 h-4 text-slate-400" />}
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Tous</option>
                <option value="image">Images</option>
                <option value="video">Vidéos</option>
                <option value="audio">Audio</option>
                <option value="document">Documents</option>
              </select>

              <Button variant="secondary" onClick={() => setDetailsOpen((v) => !v)} className="gap-2">
                <Info className="w-4 h-4" />
                {detailsOpen ? "Masquer détails" : "Afficher détails"}
              </Button>
            </div>

            {selectionCount > 0 && (
              <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-sm text-slate-700">
                  <span className="font-semibold">{selectionCount}</span> sélectionné(s)
                </div>
                <div className="flex items-center gap-2">
                  {selectedFiles.size > 0 && (
                    <Button variant="secondary" size="sm" className="gap-2" onClick={bulkCopyLinks}>
                      <Link2 className="w-4 h-4" />
                      Copier liens
                    </Button>
                  )}
                  <Button variant="danger" size="sm" className="gap-2" onClick={bulkDelete}>
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Effacer
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* List */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Fichiers</div>
              <Badge variant="default" className="text-[11px]">
                {activeTab === "drive" ? driveFiles.length : visibleFiles.length}
              </Badge>
            </div>

            {isLoading ? (
              <div className="p-10 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-slate-400" />
                Chargement…
              </div>
            ) : activeTab === "drive" ? (
              <div className="divide-y divide-slate-100">
                {driveFiles.map((file) => (
                  <div
                    key={file.id}
                    className="group flex items-center gap-4 px-4 py-3 hover:bg-slate-50 cursor-pointer"
                    onClick={() => {
                      setDetails({ kind: "file", item: file });
                      setDetailsOpen(true);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCtxMenuPos({ x: e.clientX, y: e.clientY });
                      setCtxMenuTarget({ kind: "file", item: file, isDriveItem: true });
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 ring-1 ring-blue-200/60 flex items-center justify-center flex-shrink-0">
                      <Cloud className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                        <Badge variant="primary" className="text-[10px]">
                          Drive
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        {file.formattedSize} • {typeLabel(file.mimeType)}
                      </p>
                    </div>
                    <div className="text-xs text-slate-500 hidden md:block w-28 text-right">{file.createdAt ? formatDateShort(file.createdAt) : "—"}</div>
                    <ItemMenu
                      isDriveItem
                      accent="blue"
                      onDetails={() => {
                        setDetails({ kind: "file", item: file });
                        setDetailsOpen(true);
                      }}
                      onShareLink={() => onOpenShare("file", file, "link")}
                      onShareDirect={() => onOpenShare("file", file, "direct")}
                      onRename={() => { }}
                      onMove={() => { }}
                      onDelete={() => {
                        showError("Info", "Suppression Drive non disponible ici.");
                      }}
                      onOpenExternal={() => file.webViewLink && window.open(file.webViewLink, "_blank")}
                      onImport={() => onImportFromDrive(file)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleFiles.map((file) => (
                  <div
                    key={file.id}
                    className={classNames(
                      "group flex items-center gap-4 px-4 py-3 hover:bg-slate-50 cursor-pointer",
                      selectedFiles.has(file.id) && "bg-indigo-50"
                    )}
                    onClick={() => {
                      setDetails({ kind: "file", item: file });
                      setDetailsOpen(true);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCtxMenuPos({ x: e.clientX, y: e.clientY });
                      setCtxMenuTarget({ kind: "file", item: file, isDriveItem: false });
                    }}
                  >
                    {(() => {
                      const ti = typeIcon(file.mimeType);
                      return (
                        <>
                          <button
                            className={classNames(
                              "w-5 h-5 rounded-md border flex items-center justify-center",
                              selectedFiles.has(file.id) ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-transparent group-hover:text-slate-500"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectFile(file.id);
                            }}
                            title="Sélectionner"
                          >
                            <Check className="w-3 h-3" />
                          </button>

                          <div className={classNames("w-10 h-10 rounded-xl ring-1 flex items-center justify-center flex-shrink-0", ti.bg, ti.ring)}>
                            <ti.Icon className={classNames("w-5 h-5", ti.fg)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                            <p className="text-xs text-slate-500 truncate">
                              {file.formattedSize} • {typeLabel(file.mimeType)} • {file.uploadedBy?.name ?? "—"}
                            </p>
                            {Array.isArray(file.tags) && file.tags.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {file.tags.slice(0, 3).map((t) => (
                                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                    {t}
                                  </span>
                                ))}
                                {file.tags.length > 3 && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">+{file.tags.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 hidden md:block w-28 text-right">{formatDateShort(file.createdAt)}</div>
                          <div className="hidden lg:block w-20 text-right text-xs text-slate-500">{file.formattedSize}</div>
                          <div className="flex items-center gap-1">
                            <button
                              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                              title="Télécharger"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDownload(file);
                              }}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <ItemMenu
                              accent={menuAccentForMime(file.mimeType)}
                              onDetails={() => {
                                setDetails({ kind: "file", item: file });
                                setDetailsOpen(true);
                              }}
                              onShareLink={() => onOpenShare("file", file, "link")}
                              onShareDirect={() => onOpenShare("file", file, "direct")}
                              onRename={() => onOpenRename("file", file)}
                              onMove={() => onOpenMove("file", file)}
                              onDelete={() => onDeleteFile(file)}
                            />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ))}

                {visibleFiles.length === 0 && (
                  <div className="p-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <FileIcon className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-slate-900 font-semibold">Aucun fichier</p>
                    <p className="text-sm text-slate-500 mt-1">Téléchargez un fichier ou créez un dossier.</p>
                    <div className="mt-4 flex justify-center gap-2">
                      <Button variant="secondary" onClick={() => setCreateFolderOpen(true)} className="gap-2">
                        <FolderPlus className="w-4 h-4" />
                        Nouveau dossier
                      </Button>
                      <Button variant="primary" onClick={openFilePicker} className="gap-2">
                        <Upload className="w-4 h-4" />
                        Télécharger
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Details */}
        {rightDetails && (
          <div className="col-span-12 lg:col-span-12 xl:col-span-3">
            <Card className="p-5 sticky top-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Détails</div>
                <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" onClick={() => setDetailsOpen(false)}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs text-slate-500">{details.kind === "file" ? "Fichier" : "Dossier"}</p>
                  <p className="text-base font-semibold text-slate-900 break-words">{details.item.name}</p>
                </div>

                {details.kind === "file" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-[11px] text-slate-500">Type</p>
                        <p className="text-sm font-medium text-slate-900">{typeLabel((details.item as FileItem).mimeType)}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-[11px] text-slate-500">Taille</p>
                        <p className="text-sm font-medium text-slate-900">{(details.item as FileItem).formattedSize}</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-[11px] text-slate-500">Créé</p>
                      <p className="text-sm font-medium text-slate-900">{formatDateShort((details.item as FileItem).createdAt)}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] text-slate-500">Tags</p>
                        <Tag className="w-4 h-4 text-slate-400" />
                      </div>
                      <TagsEditor
                        initial={(details.item as FileItem).tags ?? []}
                        onSave={(csv) => updateTags(details.item as FileItem, csv)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" className="gap-2" onClick={() => onOpenShare("file", details.item)}>
                        <Link2 className="w-4 h-4" />
                        Partager
                      </Button>
                      <Button variant="secondary" className="gap-2" onClick={() => onOpenRename("file", details.item)}>
                        <Pencil className="w-4 h-4" />
                        Renommer
                      </Button>
                      <Button variant="secondary" className="gap-2" onClick={() => onOpenMove("file", details.item)}>
                        <Move className="w-4 h-4" />
                        Déplacer
                      </Button>
                      <Button variant="danger" className="gap-2" onClick={() => onDeleteFile(details.item as FileItem)}>
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                      </Button>
                    </div>
                  </>
                )}

                {details.kind === "folder" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-[11px] text-slate-500">Fichiers</p>
                        <p className="text-sm font-medium text-slate-900">{(details.item as FolderItem)._count.files}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-[11px] text-slate-500">Sous-dossiers</p>
                        <p className="text-sm font-medium text-slate-900">{(details.item as FolderItem)._count.children}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" className="gap-2" onClick={() => onOpenShare("folder", details.item)}>
                        <Link2 className="w-4 h-4" />
                        Partager
                      </Button>
                      <Button variant="secondary" className="gap-2" onClick={() => onOpenRename("folder", details.item)}>
                        <Pencil className="w-4 h-4" />
                        Renommer
                      </Button>
                      <Button variant="secondary" className="gap-2" onClick={() => onOpenMove("folder", details.item)}>
                        <Move className="w-4 h-4" />
                        Déplacer
                      </Button>
                      <Button variant="danger" className="gap-2" onClick={() => onDeleteFolder(details.item as FolderItem)}>
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Right-click context menu */}
      {ctxMenuPos && ctxMenuTarget && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={ctxMenuRef}
            className="fixed z-[9999] w-56 rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-xl py-1 animate-scale-in"
            style={{ left: Math.min(ctxMenuPos.x, window.innerWidth - 224), top: Math.min(ctxMenuPos.y, window.innerHeight - 320) }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-t-xl" />
            <button
              className="w-full px-3 py-2.5 text-sm text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50"
              onClick={() => onOpenShare(ctxMenuTarget.kind, ctxMenuTarget.item, "link")}
            >
              <Link2 className="w-4 h-4 text-slate-500" />
              Partager par lien
            </button>
            {!ctxMenuTarget.isDriveItem && (
              <button
                className="w-full px-3 py-2.5 text-sm text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50"
                onClick={() => onOpenShare(ctxMenuTarget.kind, ctxMenuTarget.item, "direct")}
              >
                <UserPlus className="w-4 h-4 text-slate-500" />
                Partager directement
              </button>
            )}
            <div className="h-px bg-slate-200 my-1" />
            <button
              className="w-full px-3 py-2.5 text-sm text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setDetails({ kind: ctxMenuTarget.kind, item: ctxMenuTarget.item });
                setDetailsOpen(true);
                closeCtxMenu();
              }}
            >
              <Info className="w-4 h-4 text-slate-500" />
              Détails
            </button>
            {!ctxMenuTarget.isDriveItem && (
              <>
                <button
                  className="w-full px-3 py-2.5 text-sm text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50"
                  onClick={() => { onOpenRename(ctxMenuTarget.kind, ctxMenuTarget.item); closeCtxMenu(); }}
                >
                  <Pencil className="w-4 h-4 text-slate-500" />
                  Renommer
                </button>
                <button
                  className="w-full px-3 py-2.5 text-sm text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50"
                  onClick={() => { onOpenMove(ctxMenuTarget.kind, ctxMenuTarget.item); closeCtxMenu(); }}
                >
                  <Move className="w-4 h-4 text-slate-500" />
                  Déplacer
                </button>
              </>
            )}
            <div className="h-px bg-slate-200 my-1" />
            <button
              className="w-full px-3 py-2.5 text-sm text-left flex items-center gap-2 text-red-600 hover:bg-red-50"
              onClick={() => {
                if (ctxMenuTarget.kind === "file") onDeleteFile(ctxMenuTarget.item as FileItem);
                else onDeleteFolder(ctxMenuTarget.item as FolderItem);
                closeCtxMenu();
              }}
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
          </div>,
          document.body
        )}

      {/* Create folder */}
      <Modal
        isOpen={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        title="Créer un dossier"
        description="Un nom clair, court, et stable."
      >
        <Input label="Nom" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Ex: Contrats, Devis, KPIs…" />
        <ModalFooter>
          <Button variant="ghost" onClick={() => setCreateFolderOpen(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={createFolder} isLoading={creatingFolder} disabled={!newFolderName.trim() || creatingFolder}>
            Créer
          </Button>
        </ModalFooter>
      </Modal>

      {/* Share */}
      <Modal
        isOpen={shareOpen}
        onClose={() => { setShareOpen(false); setShareMode("link"); }}
        title="Partager"
        description={shareMode === "link" ? "Copiez un lien interne (accès selon permissions)." : "Partager avec des utilisateurs."}
      >
        <div className="space-y-3">
          {shareMode === "link" && (
            <>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-sm font-medium text-slate-900">{shareTarget?.item.name}</p>
                <p className="text-xs text-slate-500 mt-1">Lien:</p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    readOnly
                    value={
                      shareTarget?.kind === "file" && shareTarget?.item
                        ? downloadUrl((shareTarget.item as FileItem).id)
                        : window.location.href
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700"
                  />
                  <Button variant="secondary" onClick={onCopyShare} className="gap-2">
                    <Link2 className="w-4 h-4" />
                    Copier
                  </Button>
                </div>
              </div>
              {shareTarget?.kind === "file" && (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="gap-2"
                    onClick={() => {
                      const link = downloadUrl((shareTarget.item as FileItem).id);
                      window.open(link, "_blank");
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ouvrir
                  </Button>
                </div>
              )}
            </>
          )}
          {shareMode === "direct" && shareTarget && (
            <>
              <p className="text-sm font-medium text-slate-900">{shareTarget.item.name}</p>
              <p className="text-xs text-slate-500">Sélectionnez les utilisateurs avec qui partager.</p>
              {shareDirectLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {shareDirectUsers.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={shareDirectUserIds.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) setShareDirectUserIds((ids) => [...ids, u.id]);
                          else setShareDirectUserIds((ids) => ids.filter((id) => id !== u.id));
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-900 truncate">{u.name ?? u.email ?? u.id}</span>
                      {u.email && u.name && <span className="text-xs text-slate-500 truncate">{u.email}</span>}
                    </label>
                  ))}
                  {shareDirectUsers.length === 0 && !shareDirectLoading && (
                    <p className="px-3 py-4 text-sm text-slate-500">Aucun utilisateur trouvé.</p>
                  )}
                </div>
              )}
              <ModalFooter>
                <Button variant="ghost" onClick={() => setShareOpen(false)}>
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  onClick={onShareDirectSubmit}
                  isLoading={shareDirectSubmitting}
                  disabled={shareDirectUserIds.length === 0 || shareDirectSubmitting}
                  className="gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Partager avec {shareDirectUserIds.length} utilisateur(s)
                </Button>
              </ModalFooter>
            </>
          )}
        </div>
      </Modal>

      {/* Rename */}
      <Modal
        isOpen={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Renommer"
        description={renameTarget?.kind === "file" ? "Renommer le fichier (métadonnée CRM)." : "Renommer le dossier."}
      >
        <Input label="Nouveau nom" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
        <ModalFooter>
          <Button variant="ghost" onClick={() => setRenameOpen(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={onConfirmRename} isLoading={renaming} disabled={!renameValue.trim() || renaming}>
            Enregistrer
          </Button>
        </ModalFooter>
      </Modal>

      {/* Import from Google Drive - loading dialog */}
      <Modal
        isOpen={importingFromDrive}
        onClose={() => {}}
        title="Import en cours"
        description={importingFileName ? `Déplacement de « ${importingFileName} » vers le CRM…` : "Déplacement du fichier vers le CRM…"}
        size="sm"
        showCloseButton={false}
        closeOnOverlay={false}
        closeOnEscape={false}
      >
        <div className="flex items-center justify-center gap-3 py-4">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin shrink-0" />
          <p className="text-sm text-slate-600">Veuillez patienter…</p>
        </div>
      </Modal>

      {/* Move */}
      <Modal isOpen={moveOpen} onClose={() => setMoveOpen(false)} title="Déplacer" description="Choisissez un dossier de destination.">
        <div className="space-y-3">
          <div className="text-sm text-slate-700">
            Destination:{" "}
            <span className="font-semibold text-slate-900">{moveDestination ? folders.find((f) => f.id === moveDestination)?.name ?? "Dossier" : "Racine"}</span>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <button
              className={classNames(
                "w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2",
                moveDestination === null && "bg-indigo-50"
              )}
              onClick={() => setMoveDestination(null)}
            >
              <Home className="w-4 h-4 text-slate-500" />
              Racine
            </button>
            <div className="h-px bg-slate-100" />
            {folders.map((f) => (
              <button
                key={f.id}
                className={classNames(
                  "w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2",
                  moveDestination === f.id && "bg-indigo-50"
                )}
                onClick={() => setMoveDestination(f.id)}
              >
                <Folder className="w-4 h-4 text-amber-500" />
                {f.name}
              </button>
            ))}
          </div>
        </div>

        <ModalFooter>
          <Button variant="ghost" onClick={() => setMoveOpen(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={onConfirmMove} isLoading={moving} disabled={moving}>
            Déplacer
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function TagsEditor({ initial, onSave }: { initial: string[]; onSave: (csv: string) => void }) {
  const [value, setValue] = useState(initial.join(", "));
  useEffect(() => setValue(initial.join(", ")), [initial]);

  return (
    <div className="space-y-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ex: contrat, devis, Q1… (séparés par des virgules)"
        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
      />
      <Button variant="secondary" size="sm" className="gap-2" onClick={() => onSave(value)}>
        <Tag className="w-4 h-4" />
        Enregistrer tags
      </Button>
    </div>
  );
}

