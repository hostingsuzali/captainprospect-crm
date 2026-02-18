import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const path = req.nextUrl.pathname;

        // Check if user account is active
        // Note: isActive is stored in the JWT token during login
        // If a user is deactivated after login, they'll still have access until token expires
        // For immediate deactivation, you'd need to implement token blacklisting
        if (token?.isActive === false) {
            return NextResponse.redirect(new URL("/blocked", req.url));
        }

        // Role-based route protection
        // SDR routes are accessible by both SDR and BUSINESS_DEVELOPER (shared Sales execution)
        if (path.startsWith("/sdr") && token?.role !== "SDR" && token?.role !== "BUSINESS_DEVELOPER") {
            return NextResponse.redirect(new URL("/unauthorized", req.url));
        }

        if (path.startsWith("/manager") && token?.role !== "MANAGER") {
            return NextResponse.redirect(new URL("/unauthorized", req.url));
        }

        if (path.startsWith("/client") && token?.role !== "CLIENT") {
            return NextResponse.redirect(new URL("/unauthorized", req.url));
        }

        if (path.startsWith("/developer") && token?.role !== "DEVELOPER") {
            return NextResponse.redirect(new URL("/unauthorized", req.url));
        }

        if (path.startsWith("/bd") && token?.role !== "BUSINESS_DEVELOPER") {
            return NextResponse.redirect(new URL("/unauthorized", req.url));
        }

        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
    }
);

export const config = {
    matcher: ["/sdr/:path*", "/manager/:path*", "/client/:path*", "/developer/:path*", "/bd/:path*"],
};
