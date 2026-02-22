from fastapi import Request, status, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.utils.jwt_utils import JWT_HANDLER, UserJWEModel, extract_user_data_from_jwt

# Public routes that skip auth
PUBLIC_PATHS = ("/docs", "/openapi", "/health", "/redoc", "/api/v1/users/signin")


class NextAuthJWTMiddleware(BaseHTTPMiddleware):
    """
    Middleware that validates NextAuth JWE tokens from cookies
    using the fastapi-nextauth-jwt library.
    
    The frontend (Next.js server action) forwards the browser cookies
    to FastAPI. The library reads the "authjs.session-token" cookie,
    derives the decryption key via HKDF, and decrypts the JWE payload.
    """

    async def dispatch(self, request: Request, call_next):

        # Allow OPTIONS requests (CORS preflight) to pass through
        if request.method == "OPTIONS":
            return await call_next(request)

        # Skip public routes
        if request.url.path == "/" or request.url.path.startswith(PUBLIC_PATHS):
            return await call_next(request)

        try:
            # JWT_HANDLER reads the token from request.cookies automatically
            jwt_payload = JWT_HANDLER(request)

            if jwt_payload and jwt_payload.get("id"):
                print(f"[auth] JWE decrypted — user_id={jwt_payload.get('id')}, email={jwt_payload.get('email')}")

                user_data = UserJWEModel.model_validate(jwt_payload)
                user_info = extract_user_data_from_jwt(user_data)

                # Attach user data to request state
                request.state.user_id = user_info["user_id"]
                request.state.user_email = user_info["email"]
                request.state.user_jwt = user_data
            else:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Invalid JWT: missing user ID"},
                )

        except HTTPException as e:
            print(f"[auth] HTTPException: {e.detail}")
            return JSONResponse(
                status_code=e.status_code,
                content={"detail": e.detail},
            )
        except Exception as e:
            print(f"[auth] Error: {e}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "JWT validation failed"},
            )

        response = await call_next(request)
        return response