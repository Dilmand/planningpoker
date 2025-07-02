# ===== STAGE 1: Build-Umgebung =====
# Wir nutzen ein Node.js-Image, um ggf. Tools zu verwenden oder Abhängigkeiten zu installieren.
FROM node:18-alpine AS builder

# Setzt das Arbeitsverzeichnis im Container
WORKDIR /app

# Kopiert package.json und lock-Datei, um den Docker-Cache zu nutzen
COPY package.json package-lock.json ./

# Installiert Abhängigkeiten (falls welche in package.json definiert sind)
RUN npm install

# Kopiert den Rest des Quellcodes
COPY . .

# HINWEIS: Falls du ein Framework (React, Vue, etc.) mit einem Build-Schritt hättest,
# würde hier der Befehl `RUN npm run build` stehen.


# ===== STAGE 2: Produktions-Umgebung =====
# Wir nutzen ein sehr kleines und effizientes Nginx-Image als Webserver.
FROM nginx:1.27-alpine

# Kopiere die fertigen Web-Dateien aus dem `src`-Ordner der "builder"-Stage
# in das Standard-Verzeichnis von Nginx, von dem aus die Webseite ausgeliefert wird.
COPY --from=builder /app/src /usr/share/nginx/html

# Informiert Docker, dass der Container auf Port 80 lauscht.
EXPOSE 80

# Der Nginx-Container startet den Webserver automatisch.