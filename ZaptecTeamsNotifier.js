const axios = require("axios");
require('dotenv').config();
const config = require('./config');

// Get configuration from environment variables
const USERNAME = process.env.ZAPTEC_USERNAME;
const PASSWORD = process.env.ZAPTEC_PASSWORD;
const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;

let bearerToken;
let previousChargerStatuses = {};
let previousFreeChargerCount = 0;
let initialRun = true; // Added to determine if it's the first run

async function refreshBearerToken() {
    console.log("Attempting to refresh Zaptec bearer token...");
    const encodedCredentials = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

    try {
        const response = await axios.post("https://api.zaptec.com/oauth/token",
            `grant_type=password&username=${encodeURIComponent(USERNAME)}&password=${encodeURIComponent(PASSWORD)}`, {
                headers: {
                    "accept": "application/json",
                    "content-type": "application/x-www-form-urlencoded",
                    "Authorization": `Basic ${encodedCredentials}`
                }
            }
        );

        bearerToken = response.data.access_token;
        console.log("Successfully refreshed Zaptec bearer token.");
    } catch (error) {
        console.error("Failed to refresh Zaptec token:", error);
    }
}

async function checkChargerAvailability() {
    console.log("Checking charger availability...");

    const statusIcons = {
        1: "✅",
        3: "⚡",
        5: "🔋"
    };

    let availableChargers = [];
    let completedChargers = [];
    let allChargerStatuses = "";
    let freeChargersCount = 0;
    let chargingStatusChanged = false;

    try {
        const response = await axios.get("https://api.zaptec.com/api/chargers", {
            headers: {
                "Authorization": `Bearer ${bearerToken}`,
                "accept": "text/plain"
            }
        });

        const chargers = response.data.Data;
        console.log(`Found ${chargers.length} chargers.`);

        for (let charger of chargers) {
            const chargerName = charger.Name.replace(" Tobii", "");
            const previousStatus = previousChargerStatuses[charger.Id];

            allChargerStatuses += `${statusIcons[charger.OperatingMode]} `;

            if (previousStatus !== charger.OperatingMode) {
                if (charger.OperatingMode == 1) {
                    freeChargersCount++;
                    availableChargers.push(chargerName);
                } else if (charger.OperatingMode == 5) {
                    completedChargers.push(chargerName);
                } else if (charger.OperatingMode == 3) {
                    chargingStatusChanged = true;
                }

                previousChargerStatuses[charger.Id] = charger.OperatingMode;
            } else if (charger.OperatingMode == 1) {
                freeChargersCount++;
            }
        }

        if (chargingStatusChanged && previousFreeChargerCount > freeChargersCount) {
            let summaryMessage = freeChargersCount === 0 ? "❌ 0 chargers free" : `${statusIcons[1]} ${freeChargersCount} charger(s) free.`;
            console.log(summaryMessage + "\n\n" + allChargerStatuses);
            await notifyTeams(summaryMessage + "\n\n" + allChargerStatuses).catch(err => console.error("Failed to send Teams notification:", err));
        }

        if (!initialRun) {
            if (availableChargers.length) {
                const verb = availableChargers.length === 1 ? "is" : "are";
                const message = `${statusIcons[1]} ${availableChargers.join(", ")} ${verb} available!`;
                console.log(message);
                await notifyTeams(message + "\n\n" + allChargerStatuses).catch(err => console.error("Failed to send Teams notification:", err));
            }

            if (completedChargers.length) {
                const verb = completedChargers.length === 1 ? "has" : "have";
                const message = `${statusIcons[5]} ${completedChargers.join(", ")} ${verb} stopped charging.`;
                console.log(message);
                await notifyTeams(message + "\n\n" + allChargerStatuses).catch(err => console.error("Failed to send Teams notification:", err));
            }
        } else {
            console.log("Initial run, notifications are silenced.");
            initialRun = false;  // Reset the flag after the initial run
        }

        previousFreeChargerCount = freeChargersCount;

    } catch (error) {
        console.error("Failed to fetch charger data:", error);
    }
}

async function notifyTeams(message) {
    const currentHour = new Date().getHours();
    const currentDay = new Date().toLocaleString('en-us', { weekday: 'long' });

    if (currentHour >= config.startSilentHour || currentHour < config.endSilentHour || config.silentDays.includes(currentDay)) {
        console.log("Skipped Teams notification due to current time or day restrictions.");
        return;
    }

    const payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "summary": "Charger Status Update",
        "sections": [{
            "activityTitle": "Charger Status Update",
            "text": message
        }]
    };

    try {
        await axios.post(TEAMS_WEBHOOK_URL, payload);
        console.log("Sent Teams notification:", message);
    } catch (error) {
        console.error("Failed to send Teams notification:", error);
    }
}

(async () => {
    await refreshBearerToken().catch(err => console.error("Initial token refresh failed:", err));
    await checkChargerAvailability().catch(err => console.error("Initial charger check failed:", err));

    setInterval(async () => {
        await checkChargerAvailability().catch(err => console.error("Periodic charger check failed:", err));
    }, 300000);

    setInterval(async () => {
        await refreshBearerToken().catch(err => console.error("Periodic Zaptec token refresh failed:", err));
    }, 86400000);

    console.log("Setting up intervals for checking charger availability and token refresh...");
    console.log("Zaptec Teams Notifier is now running!");
})();

module.exports = {
    refreshBearerToken,
    checkChargerAvailability,
};
