import { WebSocketServer } from './core/webSocketServer';
import { AdminHandler } from './handler/adminHandler';
import { JoinerHandler } from './handler/joinerHandler';


const PORT = 8080;

async function main() {
    const server = new WebSocketServer(PORT);

    server.registerMessageHandler('admin', new AdminHandler());
    server.registerMessageHandler('joiner', new JoinerHandler());

    process.on('SIGINT', () => server.close());
    process.on('SIGTERM', () => server.close());
}

main().catch(error => {
    console.error("Fatal server error:", error);
    process.exit(1);
});