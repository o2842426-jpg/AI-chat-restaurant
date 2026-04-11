const jwt = require("jsonwebtoken");

function readBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.split(" ")[1] || null;
}

function authMiddleware(jwtSecret, db) {
  return function restaurantAuth(req, res, next) {
    try {
      const token = readBearerToken(req);
      if (!token) {
        return res.status(401).json({ error: "unauthorized" });
      }

      const decoded = jwt.verify(token, jwtSecret);
      // Allow future restaurant-role variants (owner/manager/cashier/kitchen) without breaking MVP.
      const allowedRestaurantRoles = ["restaurant", "owner", "manager", "cashier", "kitchen"];
      if (!allowedRestaurantRoles.includes(decoded.role)) {
        return res.status(401).json({ error: "unauthorized" });
      }

      req.restaurantId = decoded.restaurant_id;
      const restaurant = db
        .prepare(
          `
          SELECT id, is_active
          FROM restaurants
          WHERE id = ?
        `
        )
        .get(decoded.restaurant_id);
      if (!restaurant) {
        return res.status(401).json({ error: "restaurant not found" });
      }
      if (Number(restaurant.is_active) !== 1) {
        console.log(`[auth] blocked inactive restaurant id=${restaurant.id} path=${req.path}`);
        return res.status(403).json({ error: "restaurant account is disabled", code: "RESTAURANT_DISABLED" });
      }
      return next();
    } catch (error) {
      console.log(error.message);
      return res.status(401).json({ error: "invalid or expired token" });
    }
  };
}

function adminAuthMiddleware(jwtSecret) {
  return function adminAuth(req, res, next) {
    try {
      const token = readBearerToken(req);
      if (!token) {
        return res.status(401).json({ error: "unauthorized" });
      }

      const decoded = jwt.verify(token, jwtSecret);
      if (decoded.role !== "admin") {
        return res.status(401).json({ error: "unauthorized" });
      }

      req.adminEmail = decoded.email;
      return next();
    } catch (error) {
      console.log(error.message);
      return res.status(401).json({ error: "invalid or expired token" });
    }
  };
}

module.exports = {
  authMiddleware,
  adminAuthMiddleware,
};
