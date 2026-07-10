import jwt from "jsonwebtoken";

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // MS
    httpOnly: true, // prevent XSS attacks cross-site scripting attacks
    sameSite: "lax", // CSRF attacks cross-site request forgery attacks
    secure: false,
    path: "/"
  });

  return token;
};

// Max size of an inbound base64 image. MongoDB caps a document at 16MB; we keep
// images well under that so a message/user doc can never blow the limit.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB of decoded image data

// Validates a base64 image data URL. Returns an error string, or null if valid.
export const assertValidImage = (dataUrl) => {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return "Invalid image format";
  }

  const base64 = dataUrl.split(",")[1] || "";
  // Decoded byte size is ~3/4 of the base64 character length.
  const sizeInBytes = Math.floor((base64.length * 3) / 4);
  if (sizeInBytes > MAX_IMAGE_BYTES) {
    return "Image is too large (max 5MB)";
  }

  return null;
};
