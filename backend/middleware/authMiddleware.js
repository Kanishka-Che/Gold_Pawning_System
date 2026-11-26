
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Session from "../models/Session.js";

export const protect = async (req, res, next) => {
  try {
    const token = req.cookies?.sigiri_auth;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please login.",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      { algorithms: ["HS256"] }
    );

    if (!decoded.userId || !decoded.sessionId) {
      return res.status(401).json({
        success: false,
        message: "Invalid session",
      });
    }

    const session = await Session.findOne({
      sessionId: decoded.sessionId,
      userId: decoded.userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Session expired or revoked",
      });
    }

    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is inactive or unavailable",
      });
    }

    req.user = user;
    req.sessionId = decoded.sessionId;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session",
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
      });
    }

    next();
  };
};


export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.sigiri_auth;

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    if (!decoded.userId || !decoded.sessionId) {
      return next();
    }

    const session = await Session.findOne({
      sessionId: decoded.sessionId,
      userId: decoded.userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return next();
    }

    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return next();
    }

    req.user = user;
    req.sessionId = decoded.sessionId;

    return next();
  } catch (error) {
    return next();
  }
};

