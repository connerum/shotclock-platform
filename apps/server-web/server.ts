// Custom Next.js server with Socket.IO and Prisma

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { createReadStream, existsSync } from 'fs';
import { stat } from 'fs/promises';
import { extname, join, normalize, sep } from 'path';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { DeviceToServerEvents, ServerToDeviceEvents } from '@shotclock/shared/socket';
import { setupSocketServer, TypedServer } from './socket/server';
import { setServerIO } from './lib/socket';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || process.env.SERVER_PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const parsedUrl = parse(req.url!, true);
    const servedMedia = await serveUploadedMedia(req, res);
    if (servedMedia) return;

    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
  });

  // Store io instance globally for API routes
  (global as any).socketIO = io;
  setServerIO(io as SocketIOServer<DeviceToServerEvents, ServerToDeviceEvents>);

  // Setup Socket.IO handlers (includes device and admin handlers with Prisma integration)
  setupSocketServer(io as TypedServer);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO server running on path /socket.io`);
  });
});

// Export helper for API routes to access Socket.IO instance
export function getServerIO() {
  return (global as any).socketIO as SocketIOServer<DeviceToServerEvents, ServerToDeviceEvents>;
}

async function serveUploadedMedia(req: IncomingMessage, res: ServerResponse) {
  const pathname = parse(req.url || '').pathname;
  if (!pathname?.startsWith('/media/')) return false;

  try {
    const mediaRoot = getMediaRoot();
    const relativePath = decodeURIComponent(pathname.replace(/^\/media\//, ''));
    const normalizedRelativePath = normalize(relativePath);

    if (
      normalizedRelativePath.startsWith('..') ||
      normalizedRelativePath.includes(`${sep}..${sep}`) ||
      normalizedRelativePath.startsWith(sep)
    ) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid media path');
      return true;
    }

    const filePath = join(mediaRoot, normalizedRelativePath);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Media not found');
      return true;
    }

    const range = parseRangeHeader(req.headers.range, fileStat.size);
    if (range) {
      res.writeHead(206, {
        'Content-Type': getContentType(filePath),
        'Content-Length': range.end - range.start + 1,
        'Content-Range': `bytes ${range.start}-${range.end}/${fileStat.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      createReadStream(filePath, { start: range.start, end: range.end }).pipe(res);
      return true;
    }

    res.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'Content-Length': fileStat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    createReadStream(filePath).pipe(res);
    return true;
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Media not found');
    return true;
  }
}

function getMediaRoot() {
  const cwd = process.cwd();
  const packageMediaRoot = join(cwd, 'public', 'media');
  const repoMediaRoot = join(cwd, 'apps', 'server-web', 'public', 'media');

  if (existsSync(packageMediaRoot)) return packageMediaRoot;
  return repoMediaRoot;
}

function parseRangeHeader(rangeHeader: string | undefined, fileSize: number) {
  if (!rangeHeader) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  let start = rawStart ? Number(rawStart) : 0;
  let end = rawEnd ? Number(rawEnd) : fileSize - 1;

  if (!rawStart && rawEnd) {
    const suffixLength = Number(rawEnd);
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= fileSize) {
    return null;
  }

  return {
    start,
    end: Math.min(end, fileSize - 1),
  };
}

function getContentType(filePath: string) {
  switch (extname(filePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mov':
      return 'video/quicktime';
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.ogg':
      return 'audio/ogg';
    case '.aac':
      return 'audio/aac';
    default:
      return 'application/octet-stream';
  }
}
