document.addEventListener("DOMContentLoaded", () => {
    const avgDisplay = document.querySelector(".average-display");

    // Karten-Auswahl
    document.querySelectorAll(".card-select button").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".card-select button").forEach(b =>
                b.classList.remove("selected")
            );
            btn.classList.add("selected");

            // Eigene Karte setzen (Admin)
            const ownPlayer = document.querySelector(".player[data-own='true']");
            if (ownPlayer) {
                ownPlayer.dataset.value = btn.innerText;
            }
        });
    });

    // Reveal Cards
    const revealBtn = document.querySelector(".reveal");
    if (revealBtn) {
        revealBtn.addEventListener("click", () => {
            const players = document.querySelectorAll(".player");
            const values = [];

            players.forEach((player, index) => {
                const value = player.dataset.value || "?";
                const num = parseInt(value);

                // Avatar entfernen
                const img = player.querySelector("img");
                if (img) img.remove();

                // Alte Karte entfernen
                const oldCard = player.querySelector(".card-value");
                if (oldCard) oldCard.remove();

                // Neue Karte anzeigen
                const card = document.createElement("div");
                card.className = "card-value";
                card.innerText = value !== "?" ? value : "?";
                player.insertBefore(card, player.querySelector("span"));

                if (!isNaN(num)) values.push(num);
            });

            // Durchschnitt anzeigen
            const avg =
                values.length > 0
                    ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
                    : "?";
            if (avgDisplay) avgDisplay.innerText = avg;
        });
    }

    // Reset Cards
    const resetBtn = document.querySelector(".reset");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            const players = document.querySelectorAll(".player");
            players.forEach((player, i) => {
                const name = player.querySelector("span")?.innerText || `Spieler ${i + 1}`;
                const imgUrl = `avatare/avatar_${i + 1}.jpeg`;

                // Alte Karte entfernen
                const card = player.querySelector(".card-value");
                if (card) card.remove();

                // Avatar wieder einfügen, wenn nicht vorhanden
                if (!player.querySelector("img")) {
                    const img = document.createElement("img");
                    img.src = imgUrl;
                    player.insertBefore(img, player.querySelector("span"));
                }

                player.dataset.value = "?";
            });

            // Auswahl entfernen
            document.querySelectorAll(".card-select button").forEach(btn =>
                btn.classList.remove("selected")
            );

            // Durchschnitt zurücksetzen
            if (avgDisplay) avgDisplay.innerText = "?";
        });
    }

    // Dropdown-Funktion für Statusanzeige
    document.querySelectorAll("select").forEach(select => {
        select.addEventListener("change", () => {
            const row = select.closest("tr");
            const statusCell = row.querySelector("td:nth-child(3)");
            const action = select.value;

            if (action === "User blockieren") {
                statusCell.textContent = "🚫";
            } else if (action === "User entblockieren") {
                statusCell.textContent = "✅";
            }

            select.value = "Aktion wählen";
        });
    });
});
