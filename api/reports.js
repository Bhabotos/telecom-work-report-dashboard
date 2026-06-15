export default function handler(req, res) {
  if (req.method === "POST") {
    return res.status(200).json({
      message: "Report submitted successfully"
    });
  }

  return res.status(200).json({
    rows: [],
    pagination: {
      total: 0,
      pages: 1
    }
  });
}