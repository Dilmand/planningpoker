import { WebSocketServer } from '../core/webSocketServer';
import * as http from 'http';

describe('WebSocketServer', () => {
    let server: WebSocketServer;

    beforeEach(() => {
        server = new WebSocketServer(8080);
    });

    test('should block an IP', () => {
        const ip = '192.168.1.1';
        server.blockIP(ip);
        expect(server.isBlocked(ip)).toBe(true);
    });

    test('should unblock an IP', () => {
        const ip = '192.168.1.1';
        server.blockIP(ip);
        server.unblockIP(ip);
        expect(server.isBlocked(ip)).toBe(false);
    });

    test('should reject connection from blocked IP', () => {
        const ip = '192.168.1.1';
        server.blockIP(ip);

        const req = {
            headers: { 'x-forwarded-for': ip },
            socket: { remoteAddress: ip },
        } as unknown as http.IncomingMessage;

        const wsMock = { close: jest.fn() } as any;
        server['wss'].emit('connection', wsMock, req);

        expect(wsMock.close).toHaveBeenCalledWith(1008, 'Your IP is blocked.');
    });
});