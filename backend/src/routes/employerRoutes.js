const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/authMiddleware');
const {
  getEmployerProfile,
  updateEmployerProfile,
  uploadEmployerProfilePicture,
  uploadEmployerDocument,
  getEmployerDashboard,
  getNearbyChauffeurs,
} = require('../controllers/employerController');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'employers');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDir),
    filename: (req, file, callback) => {
      const safeExtension = path.extname(file.originalname).toLowerCase();
      callback(null, `${req.user.id}-${Date.now()}${safeExtension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    callback(null, allowedTypes.includes(file.mimetype));
  },
});

router.get('/me/profile', auth, getEmployerProfile);
router.patch('/me/profile', auth, updateEmployerProfile);
router.post('/me/profile-picture', auth, upload.single('file'), uploadEmployerProfilePicture);
router.post('/me/documents/:documentKey', auth, upload.single('file'), uploadEmployerDocument);
router.get('/me/dashboard', auth, getEmployerDashboard);
router.get('/me/chauffeurs', auth, getNearbyChauffeurs);

module.exports = router;
