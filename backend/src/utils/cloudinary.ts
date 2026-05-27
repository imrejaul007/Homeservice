import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import path from 'path';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Generate Cloudinary URL with transformations
export const generateCloudinaryUrl = (
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'scale' | 'thumb';
    gravity?: 'auto' | 'face' | 'center';
    quality?: 'auto' | number;
    format?: 'auto' | 'webp' | 'jpg' | 'png';
    radius?: number;
  } = {}
): string => {
  const {
    width = 400,
    height = 400,
    crop = 'fill',
    gravity = 'auto',
    quality = 'auto',
    format = 'auto',
    radius = 0,
  } = options;

  const transformations = [
    `w_${width}`,
    `h_${height}`,
    `c_${crop}`,
    `g_${gravity}`,
    `q_${quality}`,
    `f_${format}`,
    radius > 0 ? `r_${radius}` : '',
  ].filter(Boolean).join(',');

  return cloudinary.url(publicId, {
    transformation: transformations.split(',').map(t => {
      const [key, value] = t.split('_');
      return { [key]: value };
    }),
  });
};

// Upload buffer to Cloudinary
export const uploadBufferToCloudinary = async (
  buffer: Buffer,
  folder: string = 'general',
  options: {
    publicId?: string;
    resourceType?: 'image' | 'video' | 'raw' | 'auto';
    transformation?: any[];
  } = {}
): Promise<{ publicId: string; url: string; secureUrl: string }> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `nilin/${folder}`,
        resource_type: options.resourceType || 'image',
        public_id: options.publicId,
        transformation: options.transformation,
        eager: [
          { width: 200, height: 200, crop: 'fill', radius: 100, quality: 'auto', format: 'webp' },
          { width: 400, height: 400, crop: 'fill', radius: 200, quality: 'auto', format: 'webp' },
        ],
        eager_async: false,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            publicId: result.public_id,
            url: result.url,
            secureUrl: result.secure_url,
          });
        } else {
          reject(new Error('Upload failed: No result returned'));
        }
      }
    );

    uploadStream.end(buffer);
  });
};

// Upload file to Cloudinary
export const uploadFileToCloudinary = async (
  filePath: string,
  folder: string = 'general'
): Promise<{ publicId: string; url: string; secureUrl: string }> => {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: `nilin/${folder}`,
    resource_type: 'image',
    format: 'webp',
    quality: 'auto',
    fetch_format: 'auto',
  });

  return {
    publicId: result.public_id,
    url: result.url,
    secureUrl: result.secure_url,
  };
};

// Delete image from Cloudinary
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  await cloudinary.uploader.destroy(publicId);
};

// Multer storage for Cloudinary
export const createCloudinaryStorage = (folder: string = 'general') => {
  return new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `nilin/${folder}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      transformation: [{ width: 500, height: 500, crop: 'limit' }],
      resource_type: 'auto',
    } as any,
  });
};

// Export multer upload middleware for specific folders
export const uploadToCloudinary = (folder: string = 'general') => {
  const storage = createCloudinaryStorage(folder);
  return multer({ storage });
};

// Avatar upload configuration
export const uploadAvatar = multer({
  storage: createCloudinaryStorage('avatars'),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for avatars
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

// Portfolio upload configuration
export const uploadPortfolio = multer({
  storage: createCloudinaryStorage('portfolio'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for portfolio images
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

// Portfolio upload configuration for multiple images
const multerPortfolioUpload = multer({
  storage: createCloudinaryStorage('portfolio'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per image
    files: 5, // Max 5 images at once
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

// Export as both single upload and array upload
export const uploadPortfolioMultiple = multerPortfolioUpload.array('images', 5);
export const uploadPortfolioSingle = multerPortfolioUpload.single('image');

export default cloudinary;
