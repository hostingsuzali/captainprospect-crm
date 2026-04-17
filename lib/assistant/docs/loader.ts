import fs from "fs";
import path from "path";

interface DocMeta {
    routes: string[];
    roles: string[];
    keywords: string[];
    priority: number;
}

interface LoadedDoc {
    filename: string;
    meta: DocMeta;
    content: string;
    score: number;
}

const DOCS_DIR = path.join(process.cwd(), "lib", "assistant", "docs");
const MAX_DOC_TOKENS = 900; // ~3600 chars — keep each doc lean in context
const MAX_DOCS_INJECTED = 3;

function parseFrontmatter(raw: string): { meta: Partial<DocMeta>; body: string } {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { meta: {}, body: raw };

    const yamlBlock = match[1];
    const body = match[2];

    const meta: Partial<DocMeta> = {};
    for (const line of yamlBlock.split("\n")) {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();

        if (key === "priority") {
            meta.priority = parseInt(val, 10);
        } else if (key === "routes" || key === "roles" || key === "keywords") {
            // Parse YAML array: ["a", "b"] or [a, b]
            const items = val
                .replace(/^\[/, "")
                .replace(/\]$/, "")
                .split(",")
                .map((s) => s.trim().replace(/^["']|["']$/g, ""))
                .filter(Boolean);
            meta[key] = items;
        }
    }

    return { meta, body };
}

function truncateToTokenBudget(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    // Truncate at paragraph boundary
    const truncated = text.slice(0, maxChars);
    const lastParagraph = truncated.lastIndexOf("\n\n");
    return lastParagraph > maxChars * 0.6
        ? truncated.slice(0, lastParagraph) + "\n\n[...doc truncated for brevity]"
        : truncated + "\n\n[...doc truncated for brevity]";
}

function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function scoreDoc(
    doc: { meta: Partial<DocMeta> },
    pathname: string,
    question: string,
    userRole: string
): number {
    let score = 0;
    const normQ = normalize(question);
    const normPath = normalize(pathname || "");

    // Role match
    if (doc.meta.roles?.some((r) => r === userRole)) {
        score += 5;
    }

    // Exact route match (highest weight)
    if (doc.meta.routes?.some((r) => normalize(pathname || "").startsWith(normalize(r)))) {
        score += 20;
    }

    // Partial route overlap
    if (
        doc.meta.routes?.some((r) => {
            const normR = normalize(r);
            return normPath.includes(normR.split("/")[1] || "") && normR.length > 3;
        })
    ) {
        score += 8;
    }

    // Keyword match in question
    const keywordMatches = doc.meta.keywords?.filter((kw) =>
        normQ.includes(normalize(kw))
    ).length || 0;
    score += keywordMatches * 4;

    // Priority boost
    score += (doc.meta.priority || 5);

    return score;
}

let docsCache: Array<{ filename: string; meta: Partial<DocMeta>; content: string }> | null = null;

function loadAllDocs(): Array<{ filename: string; meta: Partial<DocMeta>; content: string }> {
    if (docsCache) return docsCache;

    try {
        if (!fs.existsSync(DOCS_DIR)) return [];
        const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));

        docsCache = files.map((filename) => {
            const raw = fs.readFileSync(path.join(DOCS_DIR, filename), "utf-8");
            const { meta, body } = parseFrontmatter(raw);
            return { filename, meta, content: body.trim() };
        });

        return docsCache;
    } catch {
        return [];
    }
}

export function buildDocsContext(
    pathname: string,
    question: string,
    userRole: string
): string {
    const docs = loadAllDocs();
    if (docs.length === 0) return "";

    const scored: LoadedDoc[] = docs
        .map((doc) => ({
            ...doc,
            score: scoreDoc(doc, pathname, question, userRole),
        }))
        .filter((d) => d.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_DOCS_INJECTED);

    if (scored.length === 0) return "";

    const sections = scored.map((doc) => {
        const truncated = truncateToTokenBudget(doc.content, MAX_DOC_TOKENS * 4);
        return `### Knowledge: ${doc.filename.replace(".md", "")}\n${truncated}`;
    });

    return `## Relevant CRM Documentation\n\n${sections.join("\n\n---\n\n")}`;
}

// Invalidate cache during development (hot reload)
export function invalidateDocsCache(): void {
    docsCache = null;
}
