import path from 'path';

const MIME_TYPES: Record<string, string> = {
	'.html': 'text/html',
	'.js': 'application/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.eot': 'application/vnd.ms-fontobject',
	'.webp': 'image/webp',
	'.webm': 'video/webm',
	'.mp4': 'video/mp4',
};

export function getMimeType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase();
	return MIME_TYPES[ext] || 'application/octet-stream';
}
