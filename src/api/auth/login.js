export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, password } = req.body || {};

  if (email === "admin@telecom.local" && password === "Admin@123") {
    return res.status(200).json({
      token: "demo-admin-token",
      user: {
        id: 1,
        name: "Admin",
        email: "admin@telecom.local",
        role: "admin",
        plannerId: null
      }
    });
  }

  return res.status(401).json({ message: "Invalid email or password" });