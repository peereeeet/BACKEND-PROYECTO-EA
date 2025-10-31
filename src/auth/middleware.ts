import { Request, Response, NextFunction } from "express";
import { verifyToken, verifyRefreshToken } from "./token";

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  
 
    const authHeader = req.headers["authorization"];
    const token: string = (authHeader && authHeader.split(" ")[1]) ?? ""; // Bearer <token>
  

  if (!token) {
    return res.status(401).json({ error: "Token requerido" });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
  

  const rol : string = (decoded as any).payload.rol;

  if (rol !== 'admin') {
    return res.status(403).json({ error: "Se requieren privilegios de administrador" });
  }

  console.log("Token verificado, usuario:", decoded);
  next();
}

export function authenticateRefreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken, userId } = req.body;
    if (!refreshToken || !userId) {
      return res.status(401).json({ error: "Refresh token y userId requeridos" });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ error: "Refresh token inválido o expirado" });
    }
    (req as any).user = decoded;

  const refreshtokenUserid : string = (decoded as any).payload.id;
    // Verificar que el userId del body coincide con el del token
    if (refreshtokenUserid !== userId) {
      return res.status(403).json({ error: "El userId no coincide con el del token" });
    }

    console.log("Refresh token verificado correctamente:", decoded);

    next();
  } catch (error) {
    console.error("Error al verificar refresh token:", error);
    return res.status(500).json({ error: "Error interno en la verificación del refresh token" });
  }
}
