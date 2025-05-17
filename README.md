# Planning Poker Application

A web-based Planning Poker application for agile teams with separate backend and frontend services. The application allows teams to estimate user stories collaboratively without requiring explicit logins, just a shared link and a name.

## Features

- **Real-time Planning Poker**: Participants can join rooms, submit estimates, and reveal results in real-time
- **No Account Required**: Access via shared links, only a name is needed to participate
- **Admin Interface**: Create rooms, manage participants, block IPs, and view logs
- **WebSocket Communication**: Real-time updates when participants join, vote, or when estimates are revealed

## Technology Stack

- **Backend**: Node.js, TypeScript, Express, Prisma ORM, PostgreSQL, Socket.io
- **Frontend**: HTML, CSS, TypeScript, Vite
- **Database**: PostgreSQL
- **Authentication**: JWT (for admin access)

## Setup

### Prerequisites

- Node.js (v14+)
- npm or yarn
- PostgreSQL

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/planningpoker.git
cd planningpoker
```

2. Install dependencies:

```bash
npm install
```

3. Set up the environment variables:

Create a `.env` file in the `packages/backend` directory:

```
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/planningpoker"

# Server
PORT=3001
NODE_ENV=development

# JWT
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRES_IN=1d

# Cors
CORS_ORIGIN=http://localhost:3000
```

4. Initialize the database:

```bash
cd packages/backend
npx prisma migrate dev --name init
```

5. Create an admin user:

```bash
npx ts-node src/utils/createAdmin.ts admin password
```

## Usage

### Development

Start both backend and frontend services:

```bash
npm run dev
```

Or, start them separately:

```bash
npm run dev:backend
npm run dev:frontend
```

### Production

Build the application:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

## How to Use

### Player View

1. Access the application at `http://localhost:3000`
2. Enter the Room ID and your name to join
3. Select a card to submit your estimate
4. Click "Reveal Cards" to show all estimates
5. Click "Clear & Start New" to start a new round

### Admin View

1. Access the admin interface at `http://localhost:3000/admin`
2. Log in with your admin credentials
3. Create rooms and manage participants
4. View and filter logs
5. Block or unblock IP addresses

## API Endpoints

### Player API

- `POST /api/rooms/join`: Join a room with a unique link identifier

### Admin API

- `POST /api/admin/login`: Authenticate as admin
- `POST /api/admin/rooms`: Create a new room
- `GET /api/admin/rooms`: Get all rooms
- `GET /api/admin/rooms/:roomId/participants`: Get participants for a room
- `DELETE /api/admin/rooms/:roomId/participants/:participantId`: Remove a participant
- `POST /api/admin/ip-block`: Block an IP address
- `GET /api/admin/ip-block`: Get all blocked IPs
- `DELETE /api/admin/ip-block/:ipAddress`: Unblock an IP address
- `GET /api/admin/logs`: Get and filter logs

## WebSocket Events

- `joinRoom`: Join a room via WebSocket
- `submitEstimate`: Submit an estimate value
- `revealEstimates`: Reveal all estimates
- `clearEstimates`: Clear estimates and start a new round
- `setStoryName`: Set the current story name

## License

This project is licensed under the MIT License - see the LICENSE file for details. 