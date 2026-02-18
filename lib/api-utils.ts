import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions, sessionFromToken } from '@/lib/auth';
import { z } from 'zod';

// ============================================
// RESPONSE HELPERS
// ============================================

export function successResponse<T>(data: T, status = 200) {
    return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(message: string, status = 400) {
    return NextResponse.json({ success: false, error: message }, { status });
}

export function paginatedResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
) {
    return NextResponse.json({
        success: true,
        data,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total,
        },
    });
}

// ============================================
// AUTH HELPERS
// ============================================
// In App Router Route Handlers, pass the request so session is read from the incoming request.
// Without it, getServerSession() may not see the cookie and returns null → 401.

export async function getAuthSession(request?: NextRequest) {
    if (request) {
        const token = await getToken({ req: request });
        return sessionFromToken(token);
    }
    return getServerSession(authOptions);
}

export async function requireAuth(request?: NextRequest) {
    const session = await getAuthSession(request);
    if (!session?.user) {
        throw new AuthError('Non authentifié', 401);
    }
    return session;
}

export async function requireRole(allowedRoles: string[], request?: NextRequest) {
    const session = await requireAuth(request);
    if (!allowedRoles.includes(session.user.role)) {
        throw new AuthError('Accès non autorisé', 403);
    }
    return session;
}

// ============================================
// CUSTOM ERRORS
// ============================================

export class AuthError extends Error {
    status: number;
    constructor(message: string, status = 401) {
        super(message);
        this.name = 'AuthError';
        this.status = status;
    }
}

export class ValidationError extends Error {
    status: number;
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
        this.status = 400;
    }
}

export class NotFoundError extends Error {
    status: number;
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundError';
        this.status = 404;
    }
}

// ============================================
// REQUEST VALIDATION
// ============================================

export async function validateRequest<T>(
    request: Request,
    schema: z.ZodSchema<T>
): Promise<T> {
    try {
        const body = await request.json();
        return schema.parse(body);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const messages = error.issues.map((issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`);
            throw new ValidationError(messages.join(', '));
        }
        throw new ValidationError('Données invalides');
    }
}

// ============================================
// ERROR HANDLER WRAPPER
// ============================================

type RouteContext<T = any> = {
    params: T;
};

type RouteHandlerWithParams<T = any> = (
    request: NextRequest,
    context: RouteContext<T>
) => Promise<NextResponse>;

type RouteHandlerWithoutParams = (
    request: NextRequest
) => Promise<NextResponse>;

// Overload signatures
export function withErrorHandler<T = any>(
    handler: RouteHandlerWithParams<T>
): RouteHandlerWithParams<T>;
export function withErrorHandler(
    handler: RouteHandlerWithoutParams
): RouteHandlerWithoutParams;

// Implementation
export function withErrorHandler<T = any>(
    handler: RouteHandlerWithParams<T> | RouteHandlerWithoutParams
): any {
    return async (request: NextRequest, context?: RouteContext<T>) => {
        try {
            if (context) {
                return await (handler as RouteHandlerWithParams<T>)(request, context);
            } else {
                return await (handler as RouteHandlerWithoutParams)(request);
            }
        } catch (error) {
            console.error('API Error:', error);

            if (error instanceof AuthError) {
                return errorResponse(error.message, error.status);
            }
            if (error instanceof ValidationError) {
                return errorResponse(error.message, error.status);
            }
            if (error instanceof NotFoundError) {
                return errorResponse(error.message, error.status);
            }

            return errorResponse('Erreur serveur interne', 500);
        }
    };
}

// ============================================
// PAGINATION HELPERS
// ============================================

export function getPaginationParams(searchParams: URLSearchParams) {
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}

// ============================================
// ZOD SCHEMAS (Shared)
// ============================================

export const idParamSchema = z.object({
    id: z.string().min(1, 'ID requis'),
});

export const paginationSchema = z.object({
    page: z.coerce.number().positive().optional().default(1),
    limit: z.coerce.number().positive().max(100).optional().default(20),
});
