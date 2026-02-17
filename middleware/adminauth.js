// module.exports = function adminAuth(req, res, next) {

//     if (!req.user) {
//         return res.status(401).json({
//             message: "Unauthorized. Please login."
//         });
//     }
//     if (req.user.role !== "admin") {
//         return res.status(403).json({
//             message: "Access denied. Admins only."
//         });
//     }

//     next();
// };
