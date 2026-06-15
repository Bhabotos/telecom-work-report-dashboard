import jwt from "jsonwebtoken";
import { get } from "./db.js";

const secret = () => process.env.JWT_SECRET || "development-only-secret-change-me";

export function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, plannerId: user.planner_id },
    secret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
  );
}

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Authentication required" });
  try {
    const payload = jwt.verify(token, secret());
    const user = get(
      "SELECT id, name, email, role, planner_id, active FROM users WHERE id = :id",
      { id: payload.id }
    );
    if (!user?.active) return res.status(401).json({ message: "Account is inactive" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: "Insufficient permission" });
    next();
  };
}
