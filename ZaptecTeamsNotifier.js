const axios = require("axios");
require('dotenv').config();

// Get configuration from environment variables
const USERNAME = process.env.ZAPTEC_USERNAME;
const PASSWORD = process.env.ZAPTEC_PASSWORD;
const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;

let bearerToken;
let previousChargerStatuses = {};
let previousFreeChargerCount = 0;

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
        });

        bearerToken = response.data.access_token;
        console.log("Successfully refreshed Zaptec bearer token.");
    } catch (error) {
        console.error("Failed to refresh Zaptec token:", error);
    }
}

async function checkChargerAvailability() {
    console.log("Checking charger availability...");

    const notifications = [];
   const statusIcons = {
        1: "![Free](https://emoji.slack-edge.com/T026162CF/zaptec-free/b9855e689e1fe92f.png)",
        3: "![Charging](https://emoji.slack-edge.com/T026162CF/zaptec-charging/a4ea5bbb8c64210b.png)",
        5: "![Charge Complete](https://emoji.slack-edge.com/T026162CF/zaptec-charge-complete/36190d8a3522b9f4.png)"
    };

    try {
        const response = await axios.get("https://api.zaptec.com/api/chargers", {
            headers: {
                "Authorization": `Bearer ${bearerToken}`,
                "accept": "text/plain"
            }
        });

        const chargers = response.data.Data;
        console.log(`Found ${chargers.length} chargers.`);

        let allChargerStatuses = ""; 
        let freeChargersCount = 0;
        let chargingStatusChanged = false;

        for (let charger of chargers) {
            const chargerName = charger.Name.replace(" Tobii", "");
            const previousStatus = previousChargerStatuses[charger.Id];

            allChargerStatuses += `${statusIcons[charger.OperatingMode]} `;

            if (previousStatus !== charger.OperatingMode) {
                if (charger.OperatingMode == 1) {
                    freeChargersCount++;
                    notifications.push(`${statusIcons[1]} ${chargerName} is available!`);
                } else if (charger.OperatingMode == 5) {
                    notifications.push(`${statusIcons[5]} ${chargerName} has stopped charging.`);
                } else if (charger.OperatingMode == 3) {
                    chargingStatusChanged = true;
                }

                previousChargerStatuses[charger.Id] = charger.OperatingMode;
            } else if (charger.OperatingMode == 1) {
                freeChargersCount++;
            }
        }

        if (chargingStatusChanged && previousFreeChargerCount !== freeChargersCount) {
            const summaryMessage = `${statusIcons[1]} ${freeChargersCount} charger(s) free.`;
            notifications.push(summaryMessage);
        }

        previousFreeChargerCount = freeChargersCount;

        for (const message of notifications) {
            console.log(message + "\n\n" + allChargerStatuses);
            await notifyTeams(message + "\n\n" + allChargerStatuses).catch(err => console.error("Failed to send Teams notification:", err));
        }
    } catch (error) {
        console.error("Failed to fetch charger data:", error);
    }
}

async function notifyTeams(message) {
    const currentHour = new Date().getHours();
    if (currentHour >= 16 || currentHour < 6) {
        console.log("Skipped Teams notification due to current time restrictions.");
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
