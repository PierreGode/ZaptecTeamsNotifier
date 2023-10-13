//@Created By Pierre Gode
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

function logWithTimestamp(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

async function refreshBearerToken() {
    logWithTimestamp("Attempting to refresh Zaptec bearer token...");
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
        logWithTimestamp("Successfully refreshed Zaptec bearer token.");
    } catch (error) {
        console.error("Failed to refresh Zaptec token:", error);
    }
}

async function checkChargerAvailability() {
    logWithTimestamp("Checking charger availability...");

    const statusIcons = {
        1: "✅",
        2: "↺",
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
        logWithTimestamp(`Found ${chargers.length} chargers.`);

    for (let charger of chargers) {
        const chargerName = charger.Name.replace(" Tobii", "");
        const previousStatus = previousChargerStatuses[charger.Id];

        allChargerStatuses += `${statusIcons[charger.OperatingMode]} `;

        if (previousStatus !== charger.OperatingMode) {
            if (charger.OperatingMode == 1) {
                freeChargersCount++;
                availableChargers.push(chargerName);
            } else if (charger.OperatingMode == 2) { 
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
            let summaryMessage = freeChargersCount === 0 ? "❌ 0 chargers available" : `${statusIcons[1]} ${freeChargersCount} charger(s) available.`;
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
            logWithTimestamp("Initial run, notifications are silenced.");
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

    logWithTimestamp(`Attempting to notify Teams. Current time: ${new Date().toLocaleTimeString()} and current day: ${currentDay}`);

    if (currentHour >= config.startSilentHour || currentHour < config.endSilentHour || config.silentDays.includes(currentDay)) {
        logWithTimestamp(`Skipped Teams notification due to current time or day restrictions. Silent hours: ${config.startSilentHour}:00 - ${config.endSilentHour}:00, Silent days: ${config.silentDays.join(", ")}`);
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
        logWithTimestamp("Sent Teams notification:", message);
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

    logWithTimestamp("Zaptec Teams Notifier is now running!");
})();

module.exports = {
    refreshBearerToken,
    checkChargerAvailability,
};
//@Created By Pierre Gode
