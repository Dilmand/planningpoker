import { WebSocketServer } from './core/webSocketServer';
import { AdminHandler } from './handler/adminHandler';
import { JoinerHandler } from './handler/joinerHandler';


const PORT = process.env.PORT || 8699;

async function main() {
    const server = new WebSocketServer(Number(PORT));

    server.registerMessageHandler('admin', new AdminHandler(server));
    server.registerMessageHandler('joiner', new JoinerHandler(server));

    process.on('SIGINT', () => server.close());
    process.on('SIGTERM', () => server.close());
}

main().catch(error => {
    console.error("Fatal server error:", error);
    process.exit(1);
});